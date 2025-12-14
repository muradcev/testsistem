package service

import (
	"context"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type DriverService struct {
	repo *repository.DriverRepository
}

func NewDriverService(repo *repository.DriverRepository) *DriverService {
	return &DriverService{repo: repo}
}

func (s *DriverService) GetByID(ctx context.Context, id uuid.UUID) (*models.Driver, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *DriverService) GetByPhone(ctx context.Context, phone string) (*models.Driver, error) {
	return s.repo.GetByPhone(ctx, phone)
}

func (s *DriverService) Update(ctx context.Context, driver *models.Driver) error {
	return s.repo.Update(ctx, driver)
}

func (s *DriverService) UpdateFCMToken(ctx context.Context, driverID uuid.UUID, token string) error {
	return s.repo.UpdateFCMToken(ctx, driverID, token)
}

func (s *DriverService) GetAll(ctx context.Context, limit, offset int) ([]models.DriverListItem, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.GetAll(ctx, limit, offset)
}

func (s *DriverService) GetActiveDrivers(ctx context.Context) ([]models.Driver, error) {
	return s.repo.GetActiveDrivers(ctx)
}

func (s *DriverService) GetDriversWithFCMToken(ctx context.Context) ([]models.Driver, error) {
	return s.repo.GetDriversWithFCMToken(ctx)
}

func (s *DriverService) GetStats(ctx context.Context) (total, active, onTrip, atHome int, err error) {
	return s.repo.GetStats(ctx)
}

func (s *DriverService) UpdateDeviceInfo(ctx context.Context, driverID uuid.UUID, info *models.DeviceInfoRequest) error {
	return s.repo.UpdateDeviceInfo(ctx, driverID, info)
}

func (s *DriverService) UpdateLastActive(ctx context.Context, driverID uuid.UUID) error {
	return s.repo.UpdateLastActive(ctx, driverID)
}

func (s *DriverService) GetDriverAppStats(ctx context.Context) (*models.DriverAppStats, error) {
	return s.repo.GetDriverAppStats(ctx)
}

// UpdateStatus - Sürücü aktif/pasif durumunu güncelle
func (s *DriverService) UpdateStatus(ctx context.Context, driverID uuid.UUID, isActive bool) error {
	return s.repo.UpdateStatus(ctx, driverID, isActive)
}

// UpdateFeatures - Sürücü özelliklerini güncelle
func (s *DriverService) UpdateFeatures(ctx context.Context, driverID uuid.UUID, features map[string]bool) error {
	return s.repo.UpdateFeatures(ctx, driverID, features)
}

// Delete - Sürücüyü sil
func (s *DriverService) Delete(ctx context.Context, driverID uuid.UUID) error {
	return s.repo.Delete(ctx, driverID)
}
