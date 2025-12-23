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

	// Duplikat önleme: Aynı driver_id ve recorded_at ile kayıt varsa kaydetme
	// 1 saniye içindeki kayıtları duplikat say
	query := `
		INSERT INTO locations (
			driver_id, vehicle_id, latitude, longitude, speed, speed_kmh, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, is_charging, power_save_mode, phone_in_use,
			connection_type, wifi_ssid, ip_address,
			accelerometer, gyroscope, max_acceleration_g,
			trigger, interval_seconds,
			recorded_at, created_at
		)
		SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
		WHERE NOT EXISTS (
			SELECT 1 FROM locations
			WHERE driver_id = $1
			AND recorded_at BETWEEN ($24::timestamptz - INTERVAL '1 second') AND ($24::timestamptz + INTERVAL '1 second')
		)
		RETURNING id
	`

	err := r.db.Pool.QueryRow(ctx, query,
		location.DriverID, location.VehicleID, location.Latitude, location.Longitude,
		location.Speed, location.SpeedKmh, location.Accuracy, location.Altitude, location.Heading,
		location.IsMoving, location.ActivityType, location.BatteryLevel, location.IsCharging, location.PowerSaveMode, location.PhoneInUse,
		location.ConnectionType, location.WifiSsid, location.IpAddress,
		location.Accelerometer, location.Gyroscope, location.MaxAccelerationG,
		location.Trigger, location.IntervalSeconds,
		location.RecordedAt, location.CreatedAt,
	).Scan(&location.ID)

	// Duplikat durumunda ErrNoRows döner, bu normal
	if err == pgx.ErrNoRows {
		return nil // Duplikat - sessizce atla
	}

	return err
}

func (r *LocationRepository) CreateBatch(ctx context.Context, locations []models.Location) error {
	if len(locations) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	// Duplikat önleme: Aynı driver_id ve recorded_at ile kayıt varsa kaydetme
	query := `
		INSERT INTO locations (
			driver_id, vehicle_id, latitude, longitude, speed, speed_kmh, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, is_charging, power_save_mode, phone_in_use,
			connection_type, wifi_ssid, ip_address,
			accelerometer, gyroscope, max_acceleration_g,
			trigger, interval_seconds,
			recorded_at, created_at
		)
		SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
		WHERE NOT EXISTS (
			SELECT 1 FROM locations
			WHERE driver_id = $1
			AND recorded_at BETWEEN ($24::timestamptz - INTERVAL '1 second') AND ($24::timestamptz + INTERVAL '1 second')
		)
	`

	now := time.Now()
	for _, loc := range locations {
		batch.Queue(query,
			loc.DriverID, loc.VehicleID, loc.Latitude, loc.Longitude,
			loc.Speed, loc.SpeedKmh, loc.Accuracy, loc.Altitude, loc.Heading,
			loc.IsMoving, loc.ActivityType, loc.BatteryLevel, loc.IsCharging, loc.PowerSaveMode, loc.PhoneInUse,
			loc.ConnectionType, loc.WifiSsid, loc.IpAddress,
			loc.Accelerometer, loc.Gyroscope, loc.MaxAccelerationG,
			loc.Trigger, loc.IntervalSeconds,
			loc.RecordedAt, now,
		)
	}

	results := r.db.Pool.SendBatch(ctx, batch)
	defer results.Close()

	// Duplikat durumunda bazı insertler 0 row affected olabilir, bu normal
	for i := 0; i < len(locations); i++ {
		if _, err := results.Exec(); err != nil {
			return fmt.Errorf("failed to insert location %d: %w", i, err)
		}
	}

	return nil
}

func (r *LocationRepository) GetByDriver(ctx context.Context, filter models.LocationFilter) ([]models.Location, error) {
	query := `
		SELECT id, driver_id, vehicle_id, latitude, longitude, speed, speed_kmh, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, is_charging, power_save_mode, COALESCE(phone_in_use, false),
			connection_type, wifi_ssid, ip_address,
			accelerometer, gyroscope, max_acceleration_g,
			trigger, interval_seconds,
			recorded_at, created_at
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
			&loc.Speed, &loc.SpeedKmh, &loc.Accuracy, &loc.Altitude, &loc.Heading,
			&loc.IsMoving, &loc.ActivityType, &loc.BatteryLevel, &loc.IsCharging, &loc.PowerSaveMode, &loc.PhoneInUse,
			&loc.ConnectionType, &loc.WifiSsid, &loc.IpAddress,
			&loc.Accelerometer, &loc.Gyroscope, &loc.MaxAccelerationG,
			&loc.Trigger, &loc.IntervalSeconds,
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
		SELECT id, driver_id, vehicle_id, latitude, longitude, speed, speed_kmh, accuracy,
			altitude, heading, is_moving, activity_type, battery_level, is_charging, power_save_mode, COALESCE(phone_in_use, false),
			connection_type, wifi_ssid, ip_address,
			accelerometer, gyroscope, max_acceleration_g,
			trigger, interval_seconds,
			recorded_at, created_at
		FROM locations
		WHERE driver_id = $1
		ORDER BY recorded_at DESC
		LIMIT 1
	`

	var loc models.Location
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(
		&loc.ID, &loc.DriverID, &loc.VehicleID, &loc.Latitude, &loc.Longitude,
		&loc.Speed, &loc.SpeedKmh, &loc.Accuracy, &loc.Altitude, &loc.Heading,
		&loc.IsMoving, &loc.ActivityType, &loc.BatteryLevel, &loc.IsCharging, &loc.PowerSaveMode, &loc.PhoneInUse,
		&loc.ConnectionType, &loc.WifiSsid, &loc.IpAddress,
		&loc.Accelerometer, &loc.Gyroscope, &loc.MaxAccelerationG,
		&loc.Trigger, &loc.IntervalSeconds,
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

// AdminLocationEntry - Admin paneli için konum kaydı
type AdminLocationEntry struct {
	ID            int64      `json:"id"`
	DriverID      uuid.UUID  `json:"driver_id"`
	DriverName    string     `json:"driver_name"`
	Latitude      float64    `json:"latitude"`
	Longitude     float64    `json:"longitude"`
	Province      *string    `json:"province,omitempty"`
	District      *string    `json:"district,omitempty"`
	StayDuration  int        `json:"stay_duration"` // dakika
	IsMoving      bool       `json:"is_moving"`
	ActivityType  string     `json:"activity_type"`
	StopID        *uuid.UUID `json:"stop_id,omitempty"`
	LocationType  *string    `json:"location_type,omitempty"`
	LocationLabel *string    `json:"location_label,omitempty"`
	RecordedAt    time.Time  `json:"recorded_at"`
}

// GetLocationsForAdmin - Admin paneli için konum listesi (filtreli, sayfalanmış)
func (r *LocationRepository) GetLocationsForAdmin(ctx context.Context, driverID *uuid.UUID, startDate, endDate *time.Time, onlyStationary bool, limit, offset int) ([]AdminLocationEntry, int, error) {
	// Ana sorgu - durağan noktaları grupla
	// Hotspot matching: 250m ≈ 0.00225 derece
	query := `
		WITH stationary_groups AS (
			SELECT
				l.id,
				l.driver_id,
				d.name || ' ' || d.surname as driver_name,
				l.latitude,
				l.longitude,
				l.is_moving,
				l.activity_type,
				l.recorded_at,
				COALESCE(s.id, NULL) as stop_id,
				COALESCE(s.location_type, h.location_type) as location_type,
				COALESCE(s.province, h.province) as province,
				COALESCE(s.district, h.district) as district,
				CASE
					WHEN LAG(l.is_moving) OVER (PARTITION BY l.driver_id ORDER BY l.recorded_at) = false
					AND l.is_moving = false
					AND ABS(l.latitude - LAG(l.latitude) OVER (PARTITION BY l.driver_id ORDER BY l.recorded_at)) < 0.002
					AND ABS(l.longitude - LAG(l.longitude) OVER (PARTITION BY l.driver_id ORDER BY l.recorded_at)) < 0.002
					THEN 0
					ELSE 1
				END as new_group
			FROM locations l
			INNER JOIN drivers d ON l.driver_id = d.id
			LEFT JOIN stops s ON l.driver_id = s.driver_id
				AND ABS(l.latitude - s.latitude) < 0.002
				AND ABS(l.longitude - s.longitude) < 0.002
			LEFT JOIN general_hotspots h ON s.id IS NULL
				AND ABS(l.latitude - h.latitude) < 0.00225
				AND ABS(l.longitude - h.longitude) < 0.00225
			WHERE 1=1
	`

	args := []interface{}{}
	argCount := 0

	if driverID != nil {
		argCount++
		query += fmt.Sprintf(" AND l.driver_id = $%d", argCount)
		args = append(args, *driverID)
	}

	if startDate != nil {
		argCount++
		query += fmt.Sprintf(" AND l.recorded_at >= $%d", argCount)
		args = append(args, *startDate)
	}

	if endDate != nil {
		argCount++
		query += fmt.Sprintf(" AND l.recorded_at <= $%d", argCount)
		args = append(args, *endDate)
	}

	if onlyStationary {
		query += " AND l.is_moving = false"
	}

	query += `
		),
		grouped AS (
			SELECT *,
				SUM(new_group) OVER (PARTITION BY driver_id ORDER BY recorded_at) as group_id
			FROM stationary_groups
		),
		aggregated AS (
			SELECT
				MIN(id) as id,
				driver_id,
				MAX(driver_name) as driver_name,
				AVG(latitude) as latitude,
				AVG(longitude) as longitude,
				MAX(province) as province,
				MAX(district) as district,
				EXTRACT(EPOCH FROM (MAX(recorded_at) - MIN(recorded_at)))/60 as stay_duration,
				bool_and(is_moving = false) as is_stationary,
				MAX(activity_type) as activity_type,
				MAX(stop_id) as stop_id,
				MAX(location_type) as location_type,
				MIN(recorded_at) as recorded_at
			FROM grouped
			GROUP BY driver_id, group_id
			HAVING EXTRACT(EPOCH FROM (MAX(recorded_at) - MIN(recorded_at)))/60 >= 5
		)
		SELECT * FROM aggregated
		ORDER BY recorded_at DESC
	`

	// Count query
	countQuery := `SELECT COUNT(*) FROM (` + query + `) AS cnt`
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Add pagination
	argCount++
	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var entries []AdminLocationEntry
	for rows.Next() {
		var e AdminLocationEntry
		var isStationary bool
		err := rows.Scan(
			&e.ID, &e.DriverID, &e.DriverName,
			&e.Latitude, &e.Longitude, &e.Province, &e.District,
			&e.StayDuration, &isStationary, &e.ActivityType,
			&e.StopID, &e.LocationType, &e.RecordedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		e.IsMoving = !isStationary

		// Location type label
		if e.LocationType != nil {
			switch *e.LocationType {
			case "home":
				label := "Ev"
				e.LocationLabel = &label
			case "loading":
				label := "Yükleme"
				e.LocationLabel = &label
			case "unloading":
				label := "Boşaltma"
				e.LocationLabel = &label
			case "rest_area":
				label := "Dinlenme Tesisi"
				e.LocationLabel = &label
			case "gas_station":
				label := "Akaryakıt"
				e.LocationLabel = &label
			case "ignored":
				label := "Önemsiz"
				e.LocationLabel = &label
			}
		}

		entries = append(entries, e)
	}

	return entries, total, nil
}

// GetRecentLiveLocationsFromDB gets the last location for each driver from the database (within specified duration)
func (r *LocationRepository) GetRecentLiveLocationsFromDB(ctx context.Context, maxAge time.Duration) ([]models.LiveLocation, error) {
	query := `
		WITH latest_locations AS (
			SELECT DISTINCT ON (l.driver_id)
				l.driver_id,
				l.latitude,
				l.longitude,
				l.speed,
				l.is_moving,
				l.activity_type,
				COALESCE(l.phone_in_use, false) as phone_in_use,
				l.recorded_at,
				d.name,
				d.surname,
				d.current_status,
				d.province,
				d.district,
				v.plate
			FROM locations l
			INNER JOIN drivers d ON l.driver_id = d.id
			LEFT JOIN vehicles v ON l.vehicle_id = v.id
			WHERE l.recorded_at >= $1
			ORDER BY l.driver_id, l.recorded_at DESC
		)
		SELECT * FROM latest_locations
	`

	cutoffTime := time.Now().Add(-maxAge)
	rows, err := r.db.Pool.Query(ctx, query, cutoffTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []models.LiveLocation
	for rows.Next() {
		var loc models.LiveLocation
		var name, surname string
		var currentStatus, province, district *string
		var recordedAt time.Time

		err := rows.Scan(
			&loc.DriverID,
			&loc.Latitude,
			&loc.Longitude,
			&loc.Speed,
			&loc.IsMoving,
			&loc.ActivityType,
			&loc.PhoneInUse,
			&recordedAt,
			&name,
			&surname,
			&currentStatus,
			&province,
			&district,
			&loc.VehiclePlate,
		)
		if err != nil {
			return nil, err
		}

		loc.DriverName = name
		loc.DriverSurname = surname
		loc.UpdatedAt = recordedAt
		if currentStatus != nil {
			loc.CurrentStatus = *currentStatus
		} else {
			loc.CurrentStatus = "unknown"
		}
		if province != nil {
			loc.Province = *province
		}
		if district != nil {
			loc.District = *district
		}

		locations = append(locations, loc)
	}

	return locations, nil
}
