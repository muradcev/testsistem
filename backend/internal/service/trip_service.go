package service

import (
	"context"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type TripService struct {
	tripRepo     *repository.TripRepository
	stopRepo     *repository.StopRepository
	locationRepo *repository.LocationRepository
}

func NewTripService(tripRepo *repository.TripRepository, stopRepo *repository.StopRepository, locationRepo *repository.LocationRepository) *TripService {
	return &TripService{
		tripRepo:     tripRepo,
		stopRepo:     stopRepo,
		locationRepo: locationRepo,
	}
}

func (s *TripService) StartTrip(ctx context.Context, driverID uuid.UUID, lat, lon float64, vehicleID *uuid.UUID) (*models.Trip, error) {
	trip := &models.Trip{
		DriverID:       driverID,
		VehicleID:      vehicleID,
		StartLatitude:  lat,
		StartLongitude: lon,
		StartedAt:      time.Now(),
	}

	if err := s.tripRepo.Create(ctx, trip); err != nil {
		return nil, err
	}

	return trip, nil
}

func (s *TripService) EndTrip(ctx context.Context, tripID uuid.UUID, lat, lon float64, distanceKm float64) error {
	trip, err := s.tripRepo.GetByID(ctx, tripID)
	if err != nil {
		return err
	}
	if trip == nil {
		return nil
	}

	now := time.Now()
	trip.EndLatitude = &lat
	trip.EndLongitude = &lon
	trip.EndedAt = &now
	trip.DistanceKm = distanceKm
	trip.DurationMinutes = int(now.Sub(trip.StartedAt).Minutes())
	trip.Status = models.TripStatusCompleted

	return s.tripRepo.Update(ctx, trip)
}

func (s *TripService) GetOngoingTrip(ctx context.Context, driverID uuid.UUID) (*models.Trip, error) {
	return s.tripRepo.GetOngoingByDriver(ctx, driverID)
}

func (s *TripService) GetDriverTrips(ctx context.Context, driverID uuid.UUID, limit, offset int) ([]models.Trip, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.tripRepo.GetByDriver(ctx, driverID, limit, offset)
}

func (s *TripService) StartStop(ctx context.Context, driverID uuid.UUID, lat, lon float64, locationType models.LocationType, isInVehicle bool) (*models.Stop, error) {
	// Devam eden sefer var mı?
	trip, _ := s.tripRepo.GetOngoingByDriver(ctx, driverID)

	stop := &models.Stop{
		DriverID:     driverID,
		Latitude:     lat,
		Longitude:    lon,
		LocationType: locationType,
		StartedAt:    time.Now(),
		IsInVehicle:  isInVehicle,
	}

	if trip != nil {
		stop.TripID = &trip.ID
	}

	if err := s.stopRepo.Create(ctx, stop); err != nil {
		return nil, err
	}

	return stop, nil
}

func (s *TripService) EndStop(ctx context.Context, stopID uuid.UUID) error {
	stop, err := s.stopRepo.GetByID(ctx, stopID)
	if err != nil {
		return err
	}
	if stop == nil {
		return nil
	}

	now := time.Now()
	stop.EndedAt = &now
	stop.DurationMinutes = int(now.Sub(stop.StartedAt).Minutes())

	return s.stopRepo.Update(ctx, stop)
}

func (s *TripService) GetOngoingStop(ctx context.Context, driverID uuid.UUID) (*models.Stop, error) {
	return s.stopRepo.GetOngoingByDriver(ctx, driverID)
}

func (s *TripService) GetDriverStops(ctx context.Context, filter models.StopFilter) ([]models.Stop, error) {
	return s.stopRepo.GetByFilter(ctx, filter)
}

func (s *TripService) GetTodayStats(ctx context.Context) (tripCount int, distanceKm float64, err error) {
	tripCount, err = s.tripRepo.GetTodayCount(ctx)
	if err != nil {
		return 0, 0, err
	}

	distanceKm, err = s.tripRepo.GetTodayDistance(ctx)
	if err != nil {
		return 0, 0, err
	}

	return tripCount, distanceKm, nil
}

func (s *TripService) GetRouteAnalysis(ctx context.Context, startDate, endDate time.Time) ([]models.RouteAnalysis, error) {
	return s.tripRepo.GetRouteAnalysis(ctx, startDate, endDate)
}

func (s *TripService) GetStopAnalysis(ctx context.Context, startDate, endDate time.Time) ([]models.StopAnalysis, error) {
	return s.stopRepo.GetStopAnalysis(ctx, startDate, endDate)
}

func (s *TripService) UpdateTripDistance(ctx context.Context, tripID uuid.UUID, distanceKm float64) error {
	trip, err := s.tripRepo.GetByID(ctx, tripID)
	if err != nil {
		return err
	}
	if trip == nil {
		return nil
	}

	trip.DistanceKm = distanceKm
	return s.tripRepo.Update(ctx, trip)
}
