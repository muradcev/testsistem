package repository

import (
	"context"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type StopRepository struct {
	db *PostgresDB
}

func NewStopRepository(db *PostgresDB) *StopRepository {
	return &StopRepository{db: db}
}

func (r *StopRepository) Create(ctx context.Context, stop *models.Stop) error {
	stop.ID = uuid.New()
	stop.CreatedAt = time.Now()
	stop.UpdatedAt = time.Now()

	query := `
		INSERT INTO stops (id, driver_id, trip_id, latitude, longitude, location_type,
			address, province, district, started_at, duration_minutes, is_in_vehicle, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		stop.ID, stop.DriverID, stop.TripID, stop.Latitude, stop.Longitude, stop.LocationType,
		stop.Address, stop.Province, stop.District, stop.StartedAt, stop.DurationMinutes,
		stop.IsInVehicle, stop.CreatedAt, stop.UpdatedAt,
	)

	return err
}

func (r *StopRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Stop, error) {
	query := `
		SELECT id, driver_id, trip_id, latitude, longitude, location_type,
			address, province, district, started_at, ended_at, duration_minutes,
			is_in_vehicle, created_at, updated_at
		FROM stops WHERE id = $1
	`

	var stop models.Stop
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&stop.ID, &stop.DriverID, &stop.TripID, &stop.Latitude, &stop.Longitude, &stop.LocationType,
		&stop.Address, &stop.Province, &stop.District, &stop.StartedAt, &stop.EndedAt, &stop.DurationMinutes,
		&stop.IsInVehicle, &stop.CreatedAt, &stop.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &stop, nil
}

func (r *StopRepository) GetOngoingByDriver(ctx context.Context, driverID uuid.UUID) (*models.Stop, error) {
	query := `
		SELECT id, driver_id, trip_id, latitude, longitude, location_type,
			address, province, district, started_at, ended_at, duration_minutes,
			is_in_vehicle, created_at, updated_at
		FROM stops WHERE driver_id = $1 AND ended_at IS NULL
		ORDER BY started_at DESC LIMIT 1
	`

	var stop models.Stop
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(
		&stop.ID, &stop.DriverID, &stop.TripID, &stop.Latitude, &stop.Longitude, &stop.LocationType,
		&stop.Address, &stop.Province, &stop.District, &stop.StartedAt, &stop.EndedAt, &stop.DurationMinutes,
		&stop.IsInVehicle, &stop.CreatedAt, &stop.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &stop, nil
}

func (r *StopRepository) GetByFilter(ctx context.Context, filter models.StopFilter) ([]models.Stop, error) {
	query := `
		SELECT id, driver_id, trip_id, latitude, longitude, location_type,
			address, province, district, started_at, ended_at, duration_minutes,
			is_in_vehicle, created_at, updated_at
		FROM stops WHERE driver_id = $1
	`
	args := []interface{}{filter.DriverID}
	argCount := 1

	if filter.TripID != nil {
		argCount++
		query += fmt.Sprintf(" AND trip_id = $%d", argCount)
		args = append(args, *filter.TripID)
	}

	if filter.LocationType != nil {
		argCount++
		query += fmt.Sprintf(" AND location_type = $%d", argCount)
		args = append(args, *filter.LocationType)
	}

	if filter.StartDate != nil {
		argCount++
		query += fmt.Sprintf(" AND started_at >= $%d", argCount)
		args = append(args, *filter.StartDate)
	}

	if filter.EndDate != nil {
		argCount++
		query += fmt.Sprintf(" AND started_at <= $%d", argCount)
		args = append(args, *filter.EndDate)
	}

	if filter.MinDuration != nil {
		argCount++
		query += fmt.Sprintf(" AND duration_minutes >= $%d", argCount)
		args = append(args, *filter.MinDuration)
	}

	query += " ORDER BY started_at DESC"

	if filter.Limit > 0 {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, filter.Limit)
	}

	if filter.Offset > 0 {
		argCount++
		query += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, filter.Offset)
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		err := rows.Scan(
			&s.ID, &s.DriverID, &s.TripID, &s.Latitude, &s.Longitude, &s.LocationType,
			&s.Address, &s.Province, &s.District, &s.StartedAt, &s.EndedAt, &s.DurationMinutes,
			&s.IsInVehicle, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		stops = append(stops, s)
	}

	return stops, nil
}

func (r *StopRepository) Update(ctx context.Context, stop *models.Stop) error {
	stop.UpdatedAt = time.Now()

	query := `
		UPDATE stops SET
			location_type = $2, ended_at = $3, duration_minutes = $4, updated_at = $5
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		stop.ID, stop.LocationType, stop.EndedAt, stop.DurationMinutes, stop.UpdatedAt,
	)

	return err
}

// ExistsAtLocationAndTime checks if a stop already exists at given location and time
func (r *StopRepository) ExistsAtLocationAndTime(ctx context.Context, driverID uuid.UUID, lat, lon float64, startedAt time.Time, radiusMeters float64) (bool, error) {
	// Use PostGIS or simple distance calculation
	// For simplicity, we check within a small time window and approximate distance
	query := `
		SELECT COUNT(*) FROM stops
		WHERE driver_id = $1
		AND started_at BETWEEN $2 AND $3
		AND ABS(latitude - $4) < 0.001
		AND ABS(longitude - $5) < 0.001
	`

	timeWindow := 5 * time.Minute
	startTime := startedAt.Add(-timeWindow)
	endTime := startedAt.Add(timeWindow)

	var count int
	err := r.db.Pool.QueryRow(ctx, query, driverID, startTime, endTime, lat, lon).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// GetUncategorized returns stops that haven't been categorized (location_type = 'unknown')
func (r *StopRepository) GetUncategorized(ctx context.Context, limit, offset int) ([]models.Stop, int, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM stops WHERE location_type = 'unknown'`
	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get stops with driver info
	query := `
		SELECT s.id, s.driver_id, s.trip_id, s.latitude, s.longitude, s.location_type,
			s.address, s.province, s.district, s.started_at, s.ended_at, s.duration_minutes,
			s.is_in_vehicle, s.created_at, s.updated_at
		FROM stops s
		WHERE s.location_type = 'unknown'
		ORDER BY s.started_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		err := rows.Scan(
			&s.ID, &s.DriverID, &s.TripID, &s.Latitude, &s.Longitude, &s.LocationType,
			&s.Address, &s.Province, &s.District, &s.StartedAt, &s.EndedAt, &s.DurationMinutes,
			&s.IsInVehicle, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		stops = append(stops, s)
	}

	return stops, total, nil
}

// GetAllStops returns all stops with pagination
func (r *StopRepository) GetAllStops(ctx context.Context, limit, offset int, locationType *string) ([]models.Stop, int, error) {
	// Build count query
	countQuery := `SELECT COUNT(*) FROM stops WHERE 1=1`
	args := []interface{}{}
	argCount := 0

	if locationType != nil && *locationType != "" {
		argCount++
		countQuery += fmt.Sprintf(" AND location_type = $%d", argCount)
		args = append(args, *locationType)
	}

	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Build main query
	query := `
		SELECT s.id, s.driver_id, s.trip_id, s.latitude, s.longitude, s.location_type,
			s.address, s.province, s.district, s.started_at, s.ended_at, s.duration_minutes,
			s.is_in_vehicle, s.created_at, s.updated_at
		FROM stops s
		WHERE 1=1
	`

	args = []interface{}{}
	argCount = 0

	if locationType != nil && *locationType != "" {
		argCount++
		query += fmt.Sprintf(" AND location_type = $%d", argCount)
		args = append(args, *locationType)
	}

	argCount++
	query += fmt.Sprintf(" ORDER BY s.started_at DESC LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		err := rows.Scan(
			&s.ID, &s.DriverID, &s.TripID, &s.Latitude, &s.Longitude, &s.LocationType,
			&s.Address, &s.Province, &s.District, &s.StartedAt, &s.EndedAt, &s.DurationMinutes,
			&s.IsInVehicle, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		stops = append(stops, s)
	}

	return stops, total, nil
}

func (r *StopRepository) GetStopAnalysis(ctx context.Context, startDate, endDate time.Time) ([]models.StopAnalysis, error) {
	query := `
		SELECT
			COALESCE(province, 'Bilinmeyen') as province,
			COALESCE(district, 'Bilinmeyen') as district,
			location_type,
			COUNT(*) as stop_count,
			AVG(duration_minutes) as avg_duration_min,
			SUM(duration_minutes) as total_duration_min
		FROM stops
		WHERE started_at >= $1 AND started_at <= $2
		GROUP BY province, district, location_type
		ORDER BY stop_count DESC
		LIMIT 100
	`

	rows, err := r.db.Pool.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.StopAnalysis
	for rows.Next() {
		var s models.StopAnalysis
		err := rows.Scan(
			&s.Province, &s.District, &s.LocationType,
			&s.StopCount, &s.AvgDurationMin, &s.TotalDurationMin,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}

	return results, nil
}
