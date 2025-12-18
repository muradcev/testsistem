package service

import (
	"context"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/data"
	"nakliyeo-mobil/internal/logger"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type TransportService struct {
	repo           *repository.TransportRepository
	routingService *RoutingService
}

func NewTransportService(repo *repository.TransportRepository, routingService *RoutingService) *TransportService {
	return &TransportService{
		repo:           repo,
		routingService: routingService,
	}
}

// calculateDistanceForProvinces - İki il arasındaki OSRM mesafesini hesapla
func (s *TransportService) calculateDistanceForProvinces(ctx context.Context, originProvince, destProvince string) *int {
	if s.routingService == nil {
		logger.Debug("RoutingService not available, skipping distance calculation")
		return nil
	}

	if originProvince == "" || destProvince == "" {
		return nil
	}

	// İl adlarını normalize et
	origin := data.NormalizeProvinceName(originProvince)
	dest := data.NormalizeProvinceName(destProvince)

	// Koordinatları al
	originCoord, originExists := data.GetProvinceCoordinate(origin)
	destCoord, destExists := data.GetProvinceCoordinate(dest)

	if !originExists {
		logger.Debug("Origin province not found in coordinates map: " + originProvince)
		return nil
	}

	if !destExists {
		logger.Debug("Destination province not found in coordinates map: " + destProvince)
		return nil
	}

	// OSRM ile karayolu mesafesi hesapla (fallback ile)
	distance, isOSRM, err := s.routingService.CalculateRouteDistanceWithFallback(
		ctx,
		originCoord.Latitude, originCoord.Longitude,
		destCoord.Latitude, destCoord.Longitude,
	)

	if err != nil {
		logger.Warn("Failed to calculate distance: " + err.Error())
		return nil
	}

	distanceInt := int(distance)

	if isOSRM {
		logger.Debug(fmt.Sprintf("OSRM distance: %s -> %s = %d km", originProvince, destProvince, distanceInt))
	} else {
		logger.Debug(fmt.Sprintf("Haversine distance: %s -> %s = %d km (OSRM unavailable)", originProvince, destProvince, distanceInt))
	}

	return &distanceInt
}

// Create - Yeni taşıma kaydı oluştur
func (s *TransportService) Create(ctx context.Context, req *models.CreateTransportRecordRequest) (*models.TransportRecord, error) {
	record := &models.TransportRecord{
		DriverID:            req.DriverID,
		Plate:               req.Plate,
		TrailerType:         req.TrailerType,
		OriginProvince:      req.OriginProvince,
		OriginDistrict:      req.OriginDistrict,
		DestinationProvince: req.DestinationProvince,
		DestinationDistrict: req.DestinationDistrict,
		CargoType:           req.CargoType,
		Notes:               req.Notes,
		Currency:            "TRY",
		SourceType:          "manual",
	}

	// Tarih parse
	if req.TransportDate != nil && *req.TransportDate != "" {
		t, err := time.Parse("2006-01-02", *req.TransportDate)
		if err == nil {
			record.TransportDate = &t
		}
	}

	// Fiyat
	if req.Price != nil {
		price := decimal.NewFromFloat(*req.Price)
		record.Price = &price
	}

	// Ağırlık
	if req.CargoWeight != nil {
		weight := decimal.NewFromFloat(*req.CargoWeight)
		record.CargoWeight = &weight
	}

	// Mesafe - Manuel girilmişse onu kullan, yoksa OSRM ile hesapla
	if req.DistanceKm != nil && *req.DistanceKm > 0 {
		record.DistanceKm = req.DistanceKm
	} else if req.OriginProvince != nil && req.DestinationProvince != nil && *req.OriginProvince != "" && *req.DestinationProvince != "" {
		// Otomatik OSRM mesafe hesaplama
		record.DistanceKm = s.calculateDistanceForProvinces(ctx, *req.OriginProvince, *req.DestinationProvince)
	}

	// Para birimi
	if req.Currency != nil && *req.Currency != "" {
		record.Currency = *req.Currency
	}

	// Kaynak tipi
	if req.SourceType != nil && *req.SourceType != "" {
		record.SourceType = *req.SourceType
	}

	// Kaynak ID
	if req.SourceID != nil && *req.SourceID != "" {
		id, err := uuid.Parse(*req.SourceID)
		if err == nil {
			record.SourceID = &id
		}
	}

	err := s.repo.Create(ctx, record)
	if err != nil {
		return nil, err
	}

	return record, nil
}

// GetByID - ID ile taşıma kaydı getir
func (s *TransportService) GetByID(ctx context.Context, id uuid.UUID) (*models.TransportRecordWithDriver, error) {
	return s.repo.GetByID(ctx, id)
}

// GetAll - Tüm taşıma kayıtlarını getir
func (s *TransportService) GetAll(ctx context.Context, limit, offset int, filters map[string]interface{}) ([]models.TransportRecordWithDriver, int, error) {
	return s.repo.GetAll(ctx, limit, offset, filters)
}

// Update - Taşıma kaydı güncelle
func (s *TransportService) Update(ctx context.Context, id uuid.UUID, req *models.UpdateTransportRecordRequest) error {
	record := &models.TransportRecord{
		Plate:               req.Plate,
		TrailerType:         req.TrailerType,
		OriginProvince:      req.OriginProvince,
		OriginDistrict:      req.OriginDistrict,
		DestinationProvince: req.DestinationProvince,
		DestinationDistrict: req.DestinationDistrict,
		CargoType:           req.CargoType,
		Notes:               req.Notes,
	}

	// Tarih parse
	if req.TransportDate != nil && *req.TransportDate != "" {
		t, err := time.Parse("2006-01-02", *req.TransportDate)
		if err == nil {
			record.TransportDate = &t
		}
	}

	// Fiyat
	if req.Price != nil {
		price := decimal.NewFromFloat(*req.Price)
		record.Price = &price
	}

	// Ağırlık
	if req.CargoWeight != nil {
		weight := decimal.NewFromFloat(*req.CargoWeight)
		record.CargoWeight = &weight
	}

	// Mesafe - Manuel girilmişse onu kullan, yoksa OSRM ile hesapla
	if req.DistanceKm != nil && *req.DistanceKm > 0 {
		record.DistanceKm = req.DistanceKm
	} else if req.OriginProvince != nil && req.DestinationProvince != nil && *req.OriginProvince != "" && *req.DestinationProvince != "" {
		// Otomatik OSRM mesafe hesaplama (güncelleme sırasında da)
		record.DistanceKm = s.calculateDistanceForProvinces(ctx, *req.OriginProvince, *req.DestinationProvince)
	}

	// Para birimi
	if req.Currency != nil && *req.Currency != "" {
		record.Currency = *req.Currency
	}

	return s.repo.Update(ctx, id, record)
}

// Delete - Taşıma kaydı sil
func (s *TransportService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// GetStats - İstatistikler
func (s *TransportService) GetStats(ctx context.Context) (*models.TransportRecordStats, error) {
	return s.repo.GetStats(ctx)
}

// GetTrailerTypes - Dorse tiplerini getir
func (s *TransportService) GetTrailerTypes(ctx context.Context) ([]models.TrailerTypeRef, error) {
	return s.repo.GetTrailerTypes(ctx)
}

// GetPricesByRoute - Güzergah bazında fiyatları getir
func (s *TransportService) GetPricesByRoute(ctx context.Context, origin, destination string, limit int) ([]models.TransportRecordWithDriver, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetPricesByRoute(ctx, origin, destination, limit)
}

// CalculateDistance - Dışarıdan mesafe hesaplama (API için)
func (s *TransportService) CalculateDistance(ctx context.Context, originProvince, destProvince string) (*int, error) {
	distance := s.calculateDistanceForProvinces(ctx, originProvince, destProvince)
	return distance, nil
}
