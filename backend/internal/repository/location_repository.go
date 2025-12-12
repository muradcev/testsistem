package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

type LocationRepository struct {
	db    *PostgresDB
	redis *RedisClient
}

func NewLocationRepository(db *PostgresDB) *LocationRepository {
	return &LocationRepository{db: db}
}

func (r *LocationRepository) SetRedis(redis *RedisClient) {
	r.redis = redis
}

func (r *LocationRepository) Create(ctx context.Context, location *models.Location) error {
	location.CreatedAt = time.Now()

	query := `
		INSERT INTO locations (driver_id, vehicle_id, latitude, longitude, speed, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, recorded_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id
	`

	err := r.db.Pool.QueryRow(ctx, query,
		location.DriverID, location.VehicleID, location.Latitude, location.Longitude,
		location.Speed, location.Accuracy, location.Altitude, location.Heading,
		location.IsMoving, location.ActivityType, location.BatteryLevel,
		location.RecordedAt, location.CreatedAt,
	).Scan(&location.ID)

	return err
}

func (r *LocationRepository) CreateBatch(ctx context.Context, locations []models.Location) error {
	if len(locations) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO locations (driver_id, vehicle_id, latitude, longitude, speed, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, recorded_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	now := time.Now()
	for _, loc := range locations {
		batch.Queue(query,
			loc.DriverID, loc.VehicleID, loc.Latitude, loc.Longitude,
			loc.Speed, loc.Accuracy, loc.Altitude, loc.Heading,
			loc.IsMoving, loc.ActivityType, loc.BatteryLevel,
			loc.RecordedAt, now,
		)
	}

	results := r.db.Pool.SendBatch(ctx, batch)
	defer results.Close()

	for i := 0; i < len(locations); i++ {
		if _, err := results.Exec(); err != nil {
			return fmt.Errorf("failed to insert location %d: %w", i, err)
		}
	}

	return nil
}

func (r *LocationRepository) GetByDriver(ctx context.Context, filter models.LocationFilter) ([]models.Location, error) {
	query := `
		SELECT id, driver_id, vehicle_id, latitude, longitude, speed, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, recorded_at, created_at
		FROM locations
		WHERE driver_id = $1
	`
	args := []interface{}{filter.DriverID}
	argCount := 1

	if filter.StartDate != nil {
		argCount++
		query += fmt.Sprintf(" AND recorded_at >= $%d", argCount)
		args = append(args, *filter.StartDate)
	}

	if filter.EndDate != nil {
		argCount++
		query += fmt.Sprintf(" AND recorded_at <= $%d", argCount)
		args = append(args, *filter.EndDate)
	}

	query += " ORDER BY recorded_at DESC"

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

	var locations []models.Location
	for rows.Next() {
		var loc models.Location
		err := rows.Scan(
			&loc.ID, &loc.DriverID, &loc.VehicleID, &loc.Latitude, &loc.Longitude,
			&loc.Speed, &loc.Accuracy, &loc.Altitude, &loc.Heading,
			&loc.IsMoving, &loc.ActivityType, &loc.BatteryLevel,
			&loc.RecordedAt, &loc.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		locations = append(locations, loc)
	}

	return locations, nil
}

func (r *LocationRepository) GetLastLocation(ctx context.Context, driverID uuid.UUID) (*models.Location, error) {
	query := `
		SELECT id, driver_id, vehicle_id, latitude, longitude, speed, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, recorded_at, created_at
		FROM locations
		WHERE driver_id = $1
		ORDER BY recorded_at DESC
		LIMIT 1
	`

	var loc models.Location
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(
		&loc.ID, &loc.DriverID, &loc.VehicleID, &loc.Latitude, &loc.Longitude,
		&loc.Speed, &loc.Accuracy, &loc.Altitude, &loc.Heading,
		&loc.IsMoving, &loc.ActivityType, &loc.BatteryLevel,
		&loc.RecordedAt, &loc.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &loc, nil
}

// Redis operations for live locations
func (r *LocationRepository) SetLiveLocation(ctx context.Context, location *models.LiveLocation) error {
	if r.redis == nil {
		return nil
	}

	data, err := json.Marshal(location)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("live_location:%s", location.DriverID)
	return r.redis.Client.Set(ctx, key, data, 5*time.Minute).Err()
}

func (r *LocationRepository) GetLiveLocation(ctx context.Context, driverID uuid.UUID) (*models.LiveLocation, error) {
	if r.redis == nil {
		return nil, nil
	}

	key := fmt.Sprintf("live_location:%s", driverID)
	data, err := r.redis.Client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var location models.LiveLocation
	if err := json.Unmarshal(data, &location); err != nil {
		return nil, err
	}

	return &location, nil
}

func (r *LocationRepository) GetAllLiveLocations(ctx context.Context) ([]models.LiveLocation, error) {
	if r.redis == nil {
		return nil, nil
	}

	keys, err := r.redis.Client.Keys(ctx, "live_location:*").Result()
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		return []models.LiveLocation{}, nil
	}

	values, err := r.redis.Client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}

	var locations []models.LiveLocation
	for _, val := range values {
		if val == nil {
			continue
		}

		var loc models.LiveLocation
		if err := json.Unmarshal([]byte(val.(string)), &loc); err != nil {
			continue
		}
		locations = append(locations, loc)
	}

	return locations, nil
}
