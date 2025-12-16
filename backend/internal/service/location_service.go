package service

import (
	"context"
	"math"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type LocationService struct {
	repo  *repository.LocationRepository
	redis *repository.RedisClient
}

func NewLocationService(repo *repository.LocationRepository, redis *repository.RedisClient) *LocationService {
	svc := &LocationService{repo: repo, redis: redis}
	repo.SetRedis(redis)
	return svc
}

func (s *LocationService) SaveLocation(ctx context.Context, driverID uuid.UUID, req *models.LocationCreateRequest) error {
	location := &models.Location{
		DriverID:     driverID,
		VehicleID:    req.VehicleID,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		Speed:        req.Speed,
		Accuracy:     req.Accuracy,
		Altitude:     req.Altitude,
		Heading:      req.Heading,
		IsMoving:     req.IsMoving,
		ActivityType: req.ActivityType,
		BatteryLevel: req.BatteryLevel,
		PhoneInUse:   req.PhoneInUse,
		RecordedAt:   req.RecordedAt.Time, // FlexibleTime'dan time.Time'a
	}

	return s.repo.Create(ctx, location)
}

func (s *LocationService) SaveBatchLocations(ctx context.Context, driverID uuid.UUID, requests []models.LocationCreateRequest) error {
	if len(requests) == 0 {
		return nil
	}

	locations := make([]models.Location, len(requests))
	for i, req := range requests {
		locations[i] = models.Location{
			DriverID:     driverID,
			VehicleID:    req.VehicleID,
			Latitude:     req.Latitude,
			Longitude:    req.Longitude,
			Speed:        req.Speed,
			Accuracy:     req.Accuracy,
			Altitude:     req.Altitude,
			Heading:      req.Heading,
			IsMoving:     req.IsMoving,
			ActivityType: req.ActivityType,
			BatteryLevel: req.BatteryLevel,
			PhoneInUse:   req.PhoneInUse,
			RecordedAt:   req.RecordedAt.Time, // FlexibleTime'dan time.Time'a
		}
	}

	return s.repo.CreateBatch(ctx, locations)
}

func (s *LocationService) GetByDriver(ctx context.Context, filter models.LocationFilter) ([]models.Location, error) {
	return s.repo.GetByDriver(ctx, filter)
}

func (s *LocationService) GetLastLocation(ctx context.Context, driverID uuid.UUID) (*models.Location, error) {
	return s.repo.GetLastLocation(ctx, driverID)
}

func (s *LocationService) SetLiveLocation(ctx context.Context, location *models.LiveLocation) error {
	return s.repo.SetLiveLocation(ctx, location)
}

func (s *LocationService) GetAllLiveLocations(ctx context.Context) ([]models.LiveLocation, error) {
	// First try Redis
	locations, err := s.repo.GetAllLiveLocations(ctx)
	if err != nil {
		return nil, err
	}

	// If Redis has data, return it
	if len(locations) > 0 {
		return locations, nil
	}

	// Fallback to database - get last locations within 1 hour
	return s.repo.GetRecentLiveLocationsFromDB(ctx, 1*time.Hour)
}

// Haversine formülü ile iki nokta arası mesafe (km)
func (s *LocationService) CalculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Dünya yarıçapı (km)

	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

// Ev konumuna yakınlık kontrolü
func (s *LocationService) IsNearHome(lat, lon, homeLat, homeLon float64, radiusMeters float64) bool {
	distance := s.CalculateDistance(lat, lon, homeLat, homeLon) * 1000 // metre
	return distance <= radiusMeters
}

// Konum geçmişinden toplam mesafe hesapla
func (s *LocationService) CalculateTotalDistance(locations []models.Location) float64 {
	if len(locations) < 2 {
		return 0
	}

	var totalDistance float64
	for i := 1; i < len(locations); i++ {
		distance := s.CalculateDistance(
			locations[i-1].Latitude, locations[i-1].Longitude,
			locations[i].Latitude, locations[i].Longitude,
		)
		totalDistance += distance
	}

	return totalDistance
}

// Konum geçmişinden süre hesapla
func (s *LocationService) CalculateDuration(locations []models.Location) int {
	if len(locations) < 2 {
		return 0
	}

	// En eski ve en yeni kayıt arasındaki fark
	start := locations[len(locations)-1].RecordedAt
	end := locations[0].RecordedAt

	duration := end.Sub(start)
	return int(duration.Minutes())
}

// Konum verilerini sıkıştır (aynı noktada birden fazla kayıt varsa birleştir)
func (s *LocationService) CompressLocations(locations []models.Location, thresholdMeters float64) []models.Location {
	if len(locations) == 0 {
		return locations
	}

	compressed := []models.Location{locations[0]}

	for i := 1; i < len(locations); i++ {
		last := compressed[len(compressed)-1]
		current := locations[i]

		distance := s.CalculateDistance(last.Latitude, last.Longitude, current.Latitude, current.Longitude) * 1000

		if distance >= thresholdMeters {
			compressed = append(compressed, current)
		}
	}

	return compressed
}

// Bugünün konum sayısı
func (s *LocationService) GetTodayLocationCount(ctx context.Context, driverID uuid.UUID) (int, error) {
	today := time.Now().Truncate(24 * time.Hour)
	filter := models.LocationFilter{
		DriverID:  driverID,
		StartDate: &today,
	}

	locations, err := s.repo.GetByDriver(ctx, filter)
	if err != nil {
		return 0, err
	}

	return len(locations), nil
}
