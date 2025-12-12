package service

import (
	"context"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type AdminService struct {
	adminRepo    *repository.AdminRepository
	settingsRepo *repository.SettingsRepository
}

func NewAdminService(adminRepo *repository.AdminRepository, settingsRepo *repository.SettingsRepository) *AdminService {
	return &AdminService{
		adminRepo:    adminRepo,
		settingsRepo: settingsRepo,
	}
}

func (s *AdminService) GetByID(ctx context.Context, id uuid.UUID) (*models.AdminUser, error) {
	return s.adminRepo.GetByID(ctx, id)
}

func (s *AdminService) GetByEmail(ctx context.Context, email string) (*models.AdminUser, error) {
	return s.adminRepo.GetByEmail(ctx, email)
}

func (s *AdminService) GetSettings(ctx context.Context) ([]models.Setting, error) {
	return s.settingsRepo.GetAll(ctx)
}

func (s *AdminService) GetSetting(ctx context.Context, key string) (*models.Setting, error) {
	return s.settingsRepo.Get(ctx, key)
}

func (s *AdminService) UpdateSettings(ctx context.Context, settings map[string]string) error {
	return s.settingsRepo.SetMultiple(ctx, settings)
}
