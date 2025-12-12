package repository

import (
	"context"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type VehicleRepository struct {
	db *PostgresDB
}

func NewVehicleRepository(db *PostgresDB) *VehicleRepository {
	return &VehicleRepository{db: db}
}

func (r *VehicleRepository) Create(ctx context.Context, vehicle *models.Vehicle) error {
	vehicle.ID = uuid.New()
	vehicle.CreatedAt = time.Now()
	vehicle.UpdatedAt = time.Now()
	vehicle.IsActive = true

	query := `
		INSERT INTO vehicles (id, driver_id, plate, brand, model, year, vehicle_type, tonnage, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		vehicle.ID, vehicle.DriverID, vehicle.Plate, vehicle.Brand, vehicle.Model,
		vehicle.Year, vehicle.VehicleType, vehicle.Tonnage, vehicle.IsActive,
		vehicle.CreatedAt, vehicle.UpdatedAt,
	)

	return err
}

func (r *VehicleRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Vehicle, error) {
	query := `
		SELECT id, driver_id, plate, brand, model, year, vehicle_type, tonnage, is_active, created_at, updated_at
		FROM vehicles WHERE id = $1
	`

	var vehicle models.Vehicle
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&vehicle.ID, &vehicle.DriverID, &vehicle.Plate, &vehicle.Brand, &vehicle.Model,
		&vehicle.Year, &vehicle.VehicleType, &vehicle.Tonnage, &vehicle.IsActive,
		&vehicle.CreatedAt, &vehicle.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &vehicle, nil
}

func (r *VehicleRepository) GetByDriverID(ctx context.Context, driverID uuid.UUID) ([]models.Vehicle, error) {
	query := `
		SELECT id, driver_id, plate, brand, model, year, vehicle_type, tonnage, is_active, created_at, updated_at
		FROM vehicles WHERE driver_id = $1 ORDER BY created_at DESC
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		err := rows.Scan(
			&v.ID, &v.DriverID, &v.Plate, &v.Brand, &v.Model,
			&v.Year, &v.VehicleType, &v.Tonnage, &v.IsActive,
			&v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		vehicles = append(vehicles, v)
	}

	return vehicles, nil
}

func (r *VehicleRepository) Update(ctx context.Context, vehicle *models.Vehicle) error {
	vehicle.UpdatedAt = time.Now()

	query := `
		UPDATE vehicles SET
			plate = $2, brand = $3, model = $4, year = $5,
			vehicle_type = $6, tonnage = $7, is_active = $8, updated_at = $9
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		vehicle.ID, vehicle.Plate, vehicle.Brand, vehicle.Model, vehicle.Year,
		vehicle.VehicleType, vehicle.Tonnage, vehicle.IsActive, vehicle.UpdatedAt,
	)

	return err
}

func (r *VehicleRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM vehicles WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *VehicleRepository) GetTotalCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM vehicles WHERE is_active = true`
	var count int
	err := r.db.Pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}
