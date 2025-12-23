package repository

import (
	"context"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type HotspotRepository struct {
	db *PostgresDB
}

func NewHotspotRepository(db *PostgresDB) *HotspotRepository {
	return &HotspotRepository{db: db}
}

// EnsureTableExists creates the general_hotspots table if it doesn't exist
func (r *HotspotRepository) EnsureTableExists(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS general_hotspots (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL DEFAULT '',
			location_type VARCHAR(50) NOT NULL,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			address TEXT,
			province VARCHAR(100),
			district VARCHAR(100),
			radius DOUBLE PRECISION NOT NULL DEFAULT 250,
			visit_count INT NOT NULL DEFAULT 1,
			is_verified BOOLEAN NOT NULL DEFAULT false,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_general_hotspots_location ON general_hotspots (latitude, longitude);
		CREATE INDEX IF NOT EXISTS idx_general_hotspots_type ON general_hotspots (location_type);
	`
	_, err := r.db.Pool.Exec(ctx, query)
	return err
}

// FindNearby finds hotspots within the given radius (in meters)
func (r *HotspotRepository) FindNearby(ctx context.Context, lat, lon float64, radiusMeters float64) ([]models.GeneralHotspot, error) {
	// Using Haversine formula approximation
	// 1 degree latitude ≈ 111km
	// For 250m, we need approximately 0.00225 degrees
	degreeApprox := radiusMeters / 111000.0

	query := `
		SELECT id, name, location_type, latitude, longitude,
		       address, province, district, radius, visit_count,
		       is_verified, created_at, updated_at
		FROM general_hotspots
		WHERE latitude BETWEEN $1 - $3 AND $1 + $3
		  AND longitude BETWEEN $2 - $3 AND $2 + $3
		  AND (
		    6371000 * acos(
		      LEAST(1.0, GREATEST(-1.0,
		        cos(radians($1)) * cos(radians(latitude)) *
		        cos(radians(longitude) - radians($2)) +
		        sin(radians($1)) * sin(radians(latitude))
		      ))
		    )
		  ) <= $4
		ORDER BY visit_count DESC
		LIMIT 10
	`

	rows, err := r.db.Pool.Query(ctx, query, lat, lon, degreeApprox, radiusMeters)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hotspots []models.GeneralHotspot
	for rows.Next() {
		var h models.GeneralHotspot
		err := rows.Scan(
			&h.ID, &h.Name, &h.LocationType, &h.Latitude, &h.Longitude,
			&h.Address, &h.Province, &h.District, &h.Radius, &h.VisitCount,
			&h.IsVerified, &h.CreatedAt, &h.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		hotspots = append(hotspots, h)
	}

	return hotspots, nil
}

// FindNearbyByType finds hotspots of a specific type within radius
func (r *HotspotRepository) FindNearbyByType(ctx context.Context, lat, lon float64, radiusMeters float64, locationType models.LocationType) (*models.GeneralHotspot, error) {
	degreeApprox := radiusMeters / 111000.0

	query := `
		SELECT id, name, location_type, latitude, longitude,
		       address, province, district, radius, visit_count,
		       is_verified, created_at, updated_at
		FROM general_hotspots
		WHERE location_type = $5
		  AND latitude BETWEEN $1 - $3 AND $1 + $3
		  AND longitude BETWEEN $2 - $3 AND $2 + $3
		  AND (
		    6371000 * acos(
		      LEAST(1.0, GREATEST(-1.0,
		        cos(radians($1)) * cos(radians(latitude)) *
		        cos(radians(longitude) - radians($2)) +
		        sin(radians($1)) * sin(radians(latitude))
		      ))
		    )
		  ) <= $4
		ORDER BY visit_count DESC
		LIMIT 1
	`

	var h models.GeneralHotspot
	err := r.db.Pool.QueryRow(ctx, query, lat, lon, degreeApprox, radiusMeters, locationType).Scan(
		&h.ID, &h.Name, &h.LocationType, &h.Latitude, &h.Longitude,
		&h.Address, &h.Province, &h.District, &h.Radius, &h.VisitCount,
		&h.IsVerified, &h.CreatedAt, &h.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &h, nil
}

// Create creates a new hotspot
func (r *HotspotRepository) Create(ctx context.Context, hotspot *models.GeneralHotspot) error {
	query := `
		INSERT INTO general_hotspots (
			id, name, location_type, latitude, longitude,
			address, province, district, radius, visit_count,
			is_verified, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		hotspot.ID, hotspot.Name, hotspot.LocationType,
		hotspot.Latitude, hotspot.Longitude,
		hotspot.Address, hotspot.Province, hotspot.District,
		hotspot.Radius, hotspot.VisitCount, hotspot.IsVerified,
		hotspot.CreatedAt, hotspot.UpdatedAt,
	)

	return err
}

// IncrementVisitCount increments the visit count for a hotspot
func (r *HotspotRepository) IncrementVisitCount(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE general_hotspots SET visit_count = visit_count + 1, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// UpdateType updates the location type for a hotspot
func (r *HotspotRepository) UpdateType(ctx context.Context, id uuid.UUID, locationType models.LocationType) error {
	query := `UPDATE general_hotspots SET location_type = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id, locationType)
	return err
}

// GetByID gets a hotspot by ID
func (r *HotspotRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.GeneralHotspot, error) {
	query := `
		SELECT id, name, location_type, latitude, longitude,
		       address, province, district, radius, visit_count,
		       is_verified, created_at, updated_at
		FROM general_hotspots
		WHERE id = $1
	`

	var h models.GeneralHotspot
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&h.ID, &h.Name, &h.LocationType, &h.Latitude, &h.Longitude,
		&h.Address, &h.Province, &h.District, &h.Radius, &h.VisitCount,
		&h.IsVerified, &h.CreatedAt, &h.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &h, nil
}

// GetAll gets all hotspots with pagination
func (r *HotspotRepository) GetAll(ctx context.Context, limit, offset int) ([]models.GeneralHotspot, int, error) {
	countQuery := `SELECT COUNT(*) FROM general_hotspots`
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, name, location_type, latitude, longitude,
		       address, province, district, radius, visit_count,
		       is_verified, created_at, updated_at
		FROM general_hotspots
		ORDER BY visit_count DESC, created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var hotspots []models.GeneralHotspot
	for rows.Next() {
		var h models.GeneralHotspot
		err := rows.Scan(
			&h.ID, &h.Name, &h.LocationType, &h.Latitude, &h.Longitude,
			&h.Address, &h.Province, &h.District, &h.Radius, &h.VisitCount,
			&h.IsVerified, &h.CreatedAt, &h.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		hotspots = append(hotspots, h)
	}

	return hotspots, total, nil
}

// Delete deletes a hotspot
func (r *HotspotRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM general_hotspots WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// FindOrCreate finds an existing hotspot nearby or creates a new one
func (r *HotspotRepository) FindOrCreate(ctx context.Context, lat, lon float64, locationType models.LocationType, radiusMeters float64) (*models.GeneralHotspot, bool, error) {
	// First, try to find a nearby hotspot of the same type
	existing, err := r.FindNearbyByType(ctx, lat, lon, radiusMeters, locationType)
	if err != nil {
		return nil, false, err
	}

	if existing != nil {
		// Found existing hotspot, increment visit count
		if err := r.IncrementVisitCount(ctx, existing.ID); err != nil {
			return nil, false, err
		}
		return existing, false, nil
	}

	// No existing hotspot, create new one
	hotspot := &models.GeneralHotspot{
		ID:           uuid.New(),
		Name:         "", // Will be set based on address later
		LocationType: locationType,
		Latitude:     lat,
		Longitude:    lon,
		Radius:       radiusMeters,
		VisitCount:   1,
		IsVerified:   false,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := r.Create(ctx, hotspot); err != nil {
		return nil, false, err
	}

	return hotspot, true, nil
}
