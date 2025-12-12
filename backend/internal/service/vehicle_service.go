package service

import (
	"context"
	"errors"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type VehicleService struct {
	repo *repository.VehicleRepository
}

func NewVehicleService(repo *repository.VehicleRepository) *VehicleService {
	return &VehicleService{repo: repo}
}

func (s *VehicleService) Create(ctx context.Context, driverID uuid.UUID, req *models.VehicleCreateRequest) (*models.Vehicle, error) {
	vehicle := &models.Vehicle{
		DriverID:    driverID,
		Plate:       req.Plate,
		Brand:       req.Brand,
		Model:       req.Model,
		Year:        req.Year,
		VehicleType: req.VehicleType,
		Tonnage:     req.Tonnage,
	}

	if err := s.repo.Create(ctx, vehicle); err != nil {
		return nil, err
	}

	return vehicle, nil
}

func (s *VehicleService) GetByDriverID(ctx context.Context, driverID uuid.UUID) ([]models.Vehicle, error) {
	return s.repo.GetByDriverID(ctx, driverID)
}

func (s *VehicleService) Update(ctx context.Context, driverID, vehicleID uuid.UUID, req *models.VehicleUpdateRequest) (*models.Vehicle, error) {
	vehicle, err := s.repo.GetByID(ctx, vehicleID)
	if err != nil {
		return nil, err
	}
	if vehicle == nil {
		return nil, errors.New("araç bulunamadı")
	}
	if vehicle.DriverID != driverID {
		return nil, errors.New("bu araca erişim yetkiniz yok")
	}

	if req.Plate != "" {
		vehicle.Plate = req.Plate
	}
	if req.Brand != "" {
		vehicle.Brand = req.Brand
	}
	if req.Model != "" {
		vehicle.Model = req.Model
	}
	if req.Year > 0 {
		vehicle.Year = req.Year
	}
	if req.VehicleType != "" {
		vehicle.VehicleType = req.VehicleType
	}
	if req.Tonnage > 0 {
		vehicle.Tonnage = req.Tonnage
	}
	if req.IsActive != nil {
		vehicle.IsActive = *req.IsActive
	}

	if err := s.repo.Update(ctx, vehicle); err != nil {
		return nil, err
	}

	return vehicle, nil
}

func (s *VehicleService) Delete(ctx context.Context, driverID, vehicleID uuid.UUID) error {
	vehicle, err := s.repo.GetByID(ctx, vehicleID)
	if err != nil {
		return err
	}
	if vehicle == nil {
		return errors.New("araç bulunamadı")
	}
	if vehicle.DriverID != driverID {
		return errors.New("bu araca erişim yetkiniz yok")
	}

	return s.repo.Delete(ctx, vehicleID)
}

func (s *VehicleService) GetTotalCount(ctx context.Context) (int, error) {
	return s.repo.GetTotalCount(ctx)
}
