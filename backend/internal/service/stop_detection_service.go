package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

const (
	// Minimum duration to consider as a stop (30 minutes)
	MinStopDurationMinutes = 30
	// Maximum distance (in meters) to consider same location
	MaxStopRadiusMeters = 100
	// Minimum speed to consider as moving (km/h)
	MinMovingSpeedKmh = 5
)

type StopDetectionService struct {
	locationRepo *repository.LocationRepository
	stopRepo     *repository.StopRepository
	driverRepo   *repository.DriverRepository
}

func NewStopDetectionService(
	locationRepo *repository.LocationRepository,
	stopRepo *repository.StopRepository,
	driverRepo *repository.DriverRepository,
) *StopDetectionService {
	return &StopDetectionService{
		locationRepo: locationRepo,
		stopRepo:     stopRepo,
		driverRepo:   driverRepo,
	}
}

// DetectStopsForDriver analyzes location data and creates stop records
func (s *StopDetectionService) DetectStopsForDriver(ctx context.Context, driverID uuid.UUID, startDate, endDate time.Time) ([]models.Stop, error) {
	// Get locations for the driver in the date range
	filter := models.LocationFilter{
		DriverID:  driverID,
		StartDate: &startDate,
		EndDate:   &endDate,
		Limit:     10000,
	}

	locations, err := s.locationRepo.GetByDriver(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to get locations: %w", err)
	}

	if len(locations) < 2 {
		return nil, nil
	}

	// Sort by recorded_at ascending
	sortLocationsByTime(locations)

	// Detect stops
	stops := s.detectStops(driverID, locations)

	// Save new stops (skip if already exists)
	var newStops []models.Stop
	for _, stop := range stops {
		// Check if stop already exists at this location and time
		exists, err := s.stopRepo.ExistsAtLocationAndTime(ctx, driverID, stop.Latitude, stop.Longitude, stop.StartedAt, MaxStopRadiusMeters)
		if err != nil {
			continue
		}
		if exists {
			continue
		}

		// Create the stop
		if err := s.stopRepo.Create(ctx, &stop); err != nil {
			continue
		}
		newStops = append(newStops, stop)
	}

	return newStops, nil
}

// DetectStopsForAllDrivers runs stop detection for all active drivers
func (s *StopDetectionService) DetectStopsForAllDrivers(ctx context.Context, startDate, endDate time.Time) (int, error) {
	drivers, _, err := s.driverRepo.GetAll(ctx, 1000, 0)
	if err != nil {
		return 0, fmt.Errorf("failed to get drivers: %w", err)
	}

	totalStops := 0
	for _, driver := range drivers {
		if !driver.IsActive {
			continue
		}

		stops, err := s.DetectStopsForDriver(ctx, driver.ID, startDate, endDate)
		if err != nil {
			continue
		}
		totalStops += len(stops)
	}

	return totalStops, nil
}

func (s *StopDetectionService) detectStops(driverID uuid.UUID, locations []models.Location) []models.Stop {
	var stops []models.Stop

	if len(locations) < 2 {
		return stops
	}

	var stopStart *models.Location
	var stopLocations []models.Location

	for i := 0; i < len(locations); i++ {
		loc := locations[i]

		// Check if this is a stationary point (low speed or marked as not moving)
		isStationary := !loc.IsMoving || (loc.Speed != nil && *loc.Speed < MinMovingSpeedKmh/3.6)

		if isStationary {
			if stopStart == nil {
				// Start of a potential stop
				stopStart = &loc
				stopLocations = []models.Location{loc}
			} else {
				// Check if still in the same area
				distance := haversineDistance(stopStart.Latitude, stopStart.Longitude, loc.Latitude, loc.Longitude)
				if distance <= MaxStopRadiusMeters {
					stopLocations = append(stopLocations, loc)
				} else {
					// Left the area, check if previous stop was long enough
					if stop := s.createStopFromLocations(driverID, stopStart, stopLocations); stop != nil {
						stops = append(stops, *stop)
					}
					// Start new potential stop
					stopStart = &loc
					stopLocations = []models.Location{loc}
				}
			}
		} else {
			// Moving - check if we had a stop
			if stopStart != nil {
				if stop := s.createStopFromLocations(driverID, stopStart, stopLocations); stop != nil {
					stops = append(stops, *stop)
				}
				stopStart = nil
				stopLocations = nil
			}
		}
	}

	// Check last potential stop
	if stopStart != nil {
		if stop := s.createStopFromLocations(driverID, stopStart, stopLocations); stop != nil {
			stops = append(stops, *stop)
		}
	}

	return stops
}

func (s *StopDetectionService) createStopFromLocations(driverID uuid.UUID, startLoc *models.Location, locations []models.Location) *models.Stop {
	if len(locations) < 2 {
		return nil
	}

	startTime := startLoc.RecordedAt
	endTime := locations[len(locations)-1].RecordedAt
	duration := int(endTime.Sub(startTime).Minutes())

	if duration < MinStopDurationMinutes {
		return nil
	}

	// Calculate average position
	var sumLat, sumLon float64
	for _, loc := range locations {
		sumLat += loc.Latitude
		sumLon += loc.Longitude
	}
	avgLat := sumLat / float64(len(locations))
	avgLon := sumLon / float64(len(locations))

	return &models.Stop{
		ID:              uuid.New(),
		DriverID:        driverID,
		Latitude:        avgLat,
		Longitude:       avgLon,
		LocationType:    models.LocationTypeUnknown,
		StartedAt:       startTime,
		EndedAt:         &endTime,
		DurationMinutes: duration,
		IsInVehicle:     true,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

// Haversine formula to calculate distance between two points in meters
func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Earth radius in meters

	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

func sortLocationsByTime(locations []models.Location) {
	// Simple bubble sort for now (locations are usually already sorted)
	for i := 0; i < len(locations)-1; i++ {
		for j := 0; j < len(locations)-i-1; j++ {
			if locations[j].RecordedAt.After(locations[j+1].RecordedAt) {
				locations[j], locations[j+1] = locations[j+1], locations[j]
			}
		}
	}
}

// GetUncategorizedStops returns stops that haven't been categorized by admin yet
func (s *StopDetectionService) GetUncategorizedStops(ctx context.Context, limit, offset int) ([]models.Stop, int, error) {
	return s.stopRepo.GetUncategorized(ctx, limit, offset)
}

// UpdateStopType updates the location type for a stop (admin categorization)
func (s *StopDetectionService) UpdateStopType(ctx context.Context, stopID uuid.UUID, locationType models.LocationType) error {
	stop, err := s.stopRepo.GetByID(ctx, stopID)
	if err != nil {
		return err
	}
	if stop == nil {
		return fmt.Errorf("stop not found")
	}

	stop.LocationType = locationType
	stop.UpdatedAt = time.Now()

	return s.stopRepo.Update(ctx, stop)
}
