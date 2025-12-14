package repository

import (
	"context"
	"fmt"
	"math"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type DriverHomeRepository struct {
	db *PostgresDB
}

func NewDriverHomeRepository(db *PostgresDB) *DriverHomeRepository {
	return &DriverHomeRepository{db: db}
}

// Create creates a new driver home location
func (r *DriverHomeRepository) Create(ctx context.Context, home *models.DriverHome) error {
	// Check if driver already has 2 homes
	count, err := r.CountByDriver(ctx, home.DriverID)
	if err != nil {
		return err
	}
	if count >= 2 {
		return fmt.Errorf("driver already has maximum number of home locations (2)")
	}

	home.ID = uuid.New()
	home.CreatedAt = time.Now()
	home.UpdatedAt = time.Now()

	if home.Radius == 0 {
		home.Radius = 200 // Default 200 meters
	}

	query := `
		INSERT INTO driver_homes (id, driver_id, name, latitude, longitude, address, province, district, radius, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err = r.db.Pool.Exec(ctx, query,
		home.ID, home.DriverID, home.Name, home.Latitude, home.Longitude,
		home.Address, home.Province, home.District, home.Radius, home.IsActive,
		home.CreatedAt, home.UpdatedAt,
	)

	return err
}

// GetByID returns a driver home by ID
func (r *DriverHomeRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.DriverHome, error) {
	query := `
		SELECT id, driver_id, name, latitude, longitude, address, province, district, radius, is_active, created_at, updated_at
		FROM driver_homes WHERE id = $1
	`

	var home models.DriverHome
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&home.ID, &home.DriverID, &home.Name, &home.Latitude, &home.Longitude,
		&home.Address, &home.Province, &home.District, &home.Radius, &home.IsActive,
		&home.CreatedAt, &home.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &home, nil
}

// GetByDriver returns all home locations for a driver
func (r *DriverHomeRepository) GetByDriver(ctx context.Context, driverID uuid.UUID) ([]models.DriverHome, error) {
	query := `
		SELECT id, driver_id, name, latitude, longitude, address, province, district, radius, is_active, created_at, updated_at
		FROM driver_homes WHERE driver_id = $1 ORDER BY name
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var homes []models.DriverHome
	for rows.Next() {
		var home models.DriverHome
		err := rows.Scan(
			&home.ID, &home.DriverID, &home.Name, &home.Latitude, &home.Longitude,
			&home.Address, &home.Province, &home.District, &home.Radius, &home.IsActive,
			&home.CreatedAt, &home.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		homes = append(homes, home)
	}

	return homes, nil
}

// GetActiveByDriver returns active home locations for a driver
func (r *DriverHomeRepository) GetActiveByDriver(ctx context.Context, driverID uuid.UUID) ([]models.DriverHome, error) {
	query := `
		SELECT id, driver_id, name, latitude, longitude, address, province, district, radius, is_active, created_at, updated_at
		FROM driver_homes WHERE driver_id = $1 AND is_active = true ORDER BY name
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var homes []models.DriverHome
	for rows.Next() {
		var home models.DriverHome
		err := rows.Scan(
			&home.ID, &home.DriverID, &home.Name, &home.Latitude, &home.Longitude,
			&home.Address, &home.Province, &home.District, &home.Radius, &home.IsActive,
			&home.CreatedAt, &home.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		homes = append(homes, home)
	}

	return homes, nil
}

// CountByDriver returns the number of home locations for a driver
func (r *DriverHomeRepository) CountByDriver(ctx context.Context, driverID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM driver_homes WHERE driver_id = $1`
	var count int
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(&count)
	return count, err
}

// Update updates a driver home location
func (r *DriverHomeRepository) Update(ctx context.Context, home *models.DriverHome) error {
	home.UpdatedAt = time.Now()

	query := `
		UPDATE driver_homes SET
			name = $2, latitude = $3, longitude = $4, address = $5, province = $6,
			district = $7, radius = $8, is_active = $9, updated_at = $10
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		home.ID, home.Name, home.Latitude, home.Longitude, home.Address,
		home.Province, home.District, home.Radius, home.IsActive, home.UpdatedAt,
	)

	return err
}

// Delete removes a driver home location
func (r *DriverHomeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM driver_homes WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// IsLocationNearHome checks if a location is within any of the driver's home radius
func (r *DriverHomeRepository) IsLocationNearHome(ctx context.Context, driverID uuid.UUID, lat, lon float64) (*models.DriverHome, bool, error) {
	homes, err := r.GetActiveByDriver(ctx, driverID)
	if err != nil {
		return nil, false, err
	}

	for _, home := range homes {
		distance := haversineDistanceMeters(home.Latitude, home.Longitude, lat, lon)
		if distance <= home.Radius {
			return &home, true, nil
		}
	}

	return nil, false, nil
}

// GetAllHomes returns all driver homes with pagination (for admin)
func (r *DriverHomeRepository) GetAllHomes(ctx context.Context, limit, offset int) ([]models.DriverHome, int, error) {
	countQuery := `SELECT COUNT(*) FROM driver_homes`
	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, driver_id, name, latitude, longitude, address, province, district, radius, is_active, created_at, updated_at
		FROM driver_homes
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var homes []models.DriverHome
	for rows.Next() {
		var home models.DriverHome
		err := rows.Scan(
			&home.ID, &home.DriverID, &home.Name, &home.Latitude, &home.Longitude,
			&home.Address, &home.Province, &home.District, &home.Radius, &home.IsActive,
			&home.CreatedAt, &home.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		homes = append(homes, home)
	}

	return homes, total, nil
}

// haversineDistanceMeters calculates distance between two points in meters
func haversineDistanceMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Earth radius in meters

	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
