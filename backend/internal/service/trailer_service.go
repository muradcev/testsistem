package service

import (
	"context"
	"errors"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type TrailerService struct {
	repo *repository.TrailerRepository
}

func NewTrailerService(repo *repository.TrailerRepository) *TrailerService {
	return &TrailerService{repo: repo}
}

func (s *TrailerService) Create(ctx context.Context, driverID uuid.UUID, req *models.TrailerCreateRequest) (*models.Trailer, error) {
	trailer := &models.Trailer{
		DriverID:    driverID,
		Plate:       req.Plate,
		TrailerType: req.TrailerType,
	}

	if err := s.repo.Create(ctx, trailer); err != nil {
		return nil, err
	}

	return trailer, nil
}

func (s *TrailerService) GetByDriverID(ctx context.Context, driverID uuid.UUID) ([]models.Trailer, error) {
	return s.repo.GetByDriverID(ctx, driverID)
}

func (s *TrailerService) Update(ctx context.Context, driverID, trailerID uuid.UUID, req *models.TrailerUpdateRequest) (*models.Trailer, error) {
	trailer, err := s.repo.GetByID(ctx, trailerID)
	if err != nil {
		return nil, err
	}
	if trailer == nil {
		return nil, errors.New("dorse bulunamadı")
	}
	if trailer.DriverID != driverID {
		return nil, errors.New("bu dorseye erişim yetkiniz yok")
	}

	if req.Plate != "" {
		trailer.Plate = req.Plate
	}
	if req.TrailerType != "" {
		trailer.TrailerType = req.TrailerType
	}
	if req.IsActive != nil {
		trailer.IsActive = *req.IsActive
	}

	if err := s.repo.Update(ctx, trailer); err != nil {
		return nil, err
	}

	return trailer, nil
}

func (s *TrailerService) Delete(ctx context.Context, driverID, trailerID uuid.UUID) error {
	trailer, err := s.repo.GetByID(ctx, trailerID)
	if err != nil {
		return err
	}
	if trailer == nil {
		return errors.New("dorse bulunamadı")
	}
	if trailer.DriverID != driverID {
		return errors.New("bu dorseye erişim yetkiniz yok")
	}

	return s.repo.Delete(ctx, trailerID)
}
