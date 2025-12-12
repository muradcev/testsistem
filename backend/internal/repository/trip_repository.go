package repository

import (
	"context"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TripRepository struct {
	db *PostgresDB
}

func NewTripRepository(db *PostgresDB) *TripRepository {
	return &TripRepository{db: db}
}

func (r *TripRepository) Create(ctx context.Context, trip *models.Trip) error {
	trip.ID = uuid.New()
	trip.CreatedAt = time.Now()
	trip.UpdatedAt = time.Now()
	trip.Status = models.TripStatusOngoing

	query := `
		INSERT INTO trips (id, driver_id, vehicle_id, start_latitude, start_longitude,
			start_address, start_province, distance_km, duration_minutes, started_at, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		trip.ID, trip.DriverID, trip.VehicleID, trip.StartLatitude, trip.StartLongitude,
		trip.StartAddress, trip.StartProvince, trip.DistanceKm, trip.DurationMinutes,
		trip.StartedAt, trip.Status, trip.CreatedAt, trip.UpdatedAt,
	)

	return err
}

func (r *TripRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Trip, error) {
	query := `
		SELECT id, driver_id, vehicle_id, start_latitude, start_longitude, start_address, start_province,
			end_latitude, end_longitude, end_address, end_province,
			distance_km, duration_minutes, started_at, ended_at, status, created_at, updated_at
		FROM trips WHERE id = $1
	`

	var trip models.Trip
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&trip.ID, &trip.DriverID, &trip.VehicleID,
		&trip.StartLatitude, &trip.StartLongitude, &trip.StartAddress, &trip.StartProvince,
		&trip.EndLatitude, &trip.EndLongitude, &trip.EndAddress, &trip.EndProvince,
		&trip.DistanceKm, &trip.DurationMinutes, &trip.StartedAt, &trip.EndedAt,
		&trip.Status, &trip.CreatedAt, &trip.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &trip, nil
}

func (r *TripRepository) GetOngoingByDriver(ctx context.Context, driverID uuid.UUID) (*models.Trip, error) {
	query := `
		SELECT id, driver_id, vehicle_id, start_latitude, start_longitude, start_address, start_province,
			end_latitude, end_longitude, end_address, end_province,
			distance_km, duration_minutes, started_at, ended_at, status, created_at, updated_at
		FROM trips WHERE driver_id = $1 AND status = 'ongoing'
		ORDER BY started_at DESC LIMIT 1
	`

	var trip models.Trip
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(
		&trip.ID, &trip.DriverID, &trip.VehicleID,
		&trip.StartLatitude, &trip.StartLongitude, &trip.StartAddress, &trip.StartProvince,
		&trip.EndLatitude, &trip.EndLongitude, &trip.EndAddress, &trip.EndProvince,
		&trip.DistanceKm, &trip.DurationMinutes, &trip.StartedAt, &trip.EndedAt,
		&trip.Status, &trip.CreatedAt, &trip.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &trip, nil
}

func (r *TripRepository) GetByDriver(ctx context.Context, driverID uuid.UUID, limit, offset int) ([]models.Trip, error) {
	query := `
		SELECT id, driver_id, vehicle_id, start_latitude, start_longitude, start_address, start_province,
			end_latitude, end_longitude, end_address, end_province,
			distance_km, duration_minutes, started_at, ended_at, status, created_at, updated_at
		FROM trips WHERE driver_id = $1
		ORDER BY started_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trips []models.Trip
	for rows.Next() {
		var t models.Trip
		err := rows.Scan(
			&t.ID, &t.DriverID, &t.VehicleID,
			&t.StartLatitude, &t.StartLongitude, &t.StartAddress, &t.StartProvince,
			&t.EndLatitude, &t.EndLongitude, &t.EndAddress, &t.EndProvince,
			&t.DistanceKm, &t.DurationMinutes, &t.StartedAt, &t.EndedAt,
			&t.Status, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		trips = append(trips, t)
	}

	return trips, nil
}

func (r *TripRepository) Update(ctx context.Context, trip *models.Trip) error {
	trip.UpdatedAt = time.Now()

	query := `
		UPDATE trips SET
			end_latitude = $2, end_longitude = $3, end_address = $4, end_province = $5,
			distance_km = $6, duration_minutes = $7, ended_at = $8, status = $9, updated_at = $10
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		trip.ID, trip.EndLatitude, trip.EndLongitude, trip.EndAddress, trip.EndProvince,
		trip.DistanceKm, trip.DurationMinutes, trip.EndedAt, trip.Status, trip.UpdatedAt,
	)

	return err
}

func (r *TripRepository) GetTodayCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM trips WHERE started_at >= CURRENT_DATE`
	var count int
	err := r.db.Pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

func (r *TripRepository) GetTodayDistance(ctx context.Context) (float64, error) {
	query := `SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE started_at >= CURRENT_DATE`
	var distance float64
	err := r.db.Pool.QueryRow(ctx, query).Scan(&distance)
	return distance, err
}

func (r *TripRepository) GetRouteAnalysis(ctx context.Context, startDate, endDate time.Time) ([]models.RouteAnalysis, error) {
	query := `
		SELECT
			COALESCE(start_province, 'Bilinmeyen') as start_province,
			COALESCE(end_province, 'Bilinmeyen') as end_province,
			COUNT(*) as trip_count,
			AVG(distance_km) as avg_distance_km,
			AVG(duration_minutes) as avg_duration_min,
			SUM(distance_km) as total_distance_km
		FROM trips
		WHERE status = 'completed'
			AND started_at >= $1 AND started_at <= $2
			AND end_province IS NOT NULL
		GROUP BY start_province, end_province
		ORDER BY trip_count DESC
		LIMIT 50
	`

	rows, err := r.db.Pool.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.RouteAnalysis
	for rows.Next() {
		var r models.RouteAnalysis
		err := rows.Scan(
			&r.StartProvince, &r.EndProvince, &r.TripCount,
			&r.AvgDistanceKm, &r.AvgDurationMin, &r.TotalDistanceKm,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan route analysis: %w", err)
		}
		results = append(results, r)
	}

	return results, nil
}
