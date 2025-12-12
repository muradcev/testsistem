package repository

import (
	"context"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type DriverRepository struct {
	db *PostgresDB
}

func NewDriverRepository(db *PostgresDB) *DriverRepository {
	return &DriverRepository{db: db}
}

func (r *DriverRepository) Create(ctx context.Context, driver *models.Driver) error {
	driver.ID = uuid.New()
	driver.CreatedAt = time.Now()
	driver.UpdatedAt = time.Now()
	driver.IsActive = true
	driver.CurrentStatus = "unknown"

	query := `
		INSERT INTO drivers (id, phone, name, surname, password_hash, province, district, neighborhood,
			home_latitude, home_longitude, is_active, is_phone_verified, current_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		driver.ID, driver.Phone, driver.Name, driver.Surname, driver.PasswordHash,
		driver.Province, driver.District, driver.Neighborhood,
		driver.HomeLatitude, driver.HomeLongitude,
		driver.IsActive, driver.IsPhoneVerified, driver.CurrentStatus,
		driver.CreatedAt, driver.UpdatedAt,
	)

	return err
}

func (r *DriverRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Driver, error) {
	query := `
		SELECT id, phone, name, surname, password_hash, province, district, neighborhood,
			home_latitude, home_longitude, fcm_token, is_active, is_phone_verified,
			last_location_at, last_latitude, last_longitude, current_status,
			app_version, app_build_number, device_model, device_os, device_os_version,
			last_active_at, app_installed_at, push_enabled, location_permission, background_location_enabled,
			created_at, updated_at
		FROM drivers WHERE id = $1
	`

	var driver models.Driver
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&driver.ID, &driver.Phone, &driver.Name, &driver.Surname, &driver.PasswordHash,
		&driver.Province, &driver.District, &driver.Neighborhood,
		&driver.HomeLatitude, &driver.HomeLongitude, &driver.FCMToken,
		&driver.IsActive, &driver.IsPhoneVerified,
		&driver.LastLocationAt, &driver.LastLatitude, &driver.LastLongitude,
		&driver.CurrentStatus,
		&driver.AppVersion, &driver.AppBuildNumber, &driver.DeviceModel, &driver.DeviceOS, &driver.DeviceOSVersion,
		&driver.LastActiveAt, &driver.AppInstalledAt, &driver.PushEnabled, &driver.LocationPermission, &driver.BackgroundLocationEnabled,
		&driver.CreatedAt, &driver.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &driver, nil
}

func (r *DriverRepository) GetByPhone(ctx context.Context, phone string) (*models.Driver, error) {
	query := `
		SELECT id, phone, name, surname, password_hash, province, district, neighborhood,
			home_latitude, home_longitude, fcm_token, is_active, is_phone_verified,
			last_location_at, last_latitude, last_longitude, current_status,
			app_version, app_build_number, device_model, device_os, device_os_version,
			last_active_at, app_installed_at, push_enabled, location_permission, background_location_enabled,
			created_at, updated_at
		FROM drivers WHERE phone = $1
	`

	var driver models.Driver
	err := r.db.Pool.QueryRow(ctx, query, phone).Scan(
		&driver.ID, &driver.Phone, &driver.Name, &driver.Surname, &driver.PasswordHash,
		&driver.Province, &driver.District, &driver.Neighborhood,
		&driver.HomeLatitude, &driver.HomeLongitude, &driver.FCMToken,
		&driver.IsActive, &driver.IsPhoneVerified,
		&driver.LastLocationAt, &driver.LastLatitude, &driver.LastLongitude,
		&driver.CurrentStatus,
		&driver.AppVersion, &driver.AppBuildNumber, &driver.DeviceModel, &driver.DeviceOS, &driver.DeviceOSVersion,
		&driver.LastActiveAt, &driver.AppInstalledAt, &driver.PushEnabled, &driver.LocationPermission, &driver.BackgroundLocationEnabled,
		&driver.CreatedAt, &driver.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &driver, nil
}

func (r *DriverRepository) Update(ctx context.Context, driver *models.Driver) error {
	driver.UpdatedAt = time.Now()

	query := `
		UPDATE drivers SET
			name = $2, surname = $3, province = $4, district = $5, neighborhood = $6,
			home_latitude = $7, home_longitude = $8, is_active = $9, is_phone_verified = $10,
			current_status = $11, updated_at = $12
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		driver.ID, driver.Name, driver.Surname, driver.Province, driver.District, driver.Neighborhood,
		driver.HomeLatitude, driver.HomeLongitude, driver.IsActive, driver.IsPhoneVerified,
		driver.CurrentStatus, driver.UpdatedAt,
	)

	return err
}

func (r *DriverRepository) UpdateFCMToken(ctx context.Context, driverID uuid.UUID, token string) error {
	query := `UPDATE drivers SET fcm_token = $2, updated_at = $3 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, driverID, token, time.Now())
	return err
}

func (r *DriverRepository) UpdateLocation(ctx context.Context, driverID uuid.UUID, lat, lng float64, status string) error {
	query := `
		UPDATE drivers SET
			last_latitude = $2, last_longitude = $3, last_location_at = $4,
			current_status = $5, updated_at = $4
		WHERE id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, driverID, lat, lng, time.Now(), status)
	return err
}

func (r *DriverRepository) UpdatePhoneVerified(ctx context.Context, driverID uuid.UUID) error {
	query := `UPDATE drivers SET is_phone_verified = true, updated_at = $2 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, driverID, time.Now())
	return err
}

func (r *DriverRepository) GetAll(ctx context.Context, limit, offset int) ([]models.DriverListItem, int, error) {
	countQuery := `SELECT COUNT(*) FROM drivers`
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT d.id, d.phone, d.name, d.surname, d.province, d.district,
			d.is_active, d.current_status, d.last_latitude, d.last_longitude, d.last_location_at,
			d.created_at, COUNT(v.id) as vehicle_count,
			d.app_version, d.device_os, d.last_active_at, d.app_installed_at
		FROM drivers d
		LEFT JOIN vehicles v ON d.id = v.driver_id AND v.is_active = true
		GROUP BY d.id
		ORDER BY d.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var drivers []models.DriverListItem
	for rows.Next() {
		var d models.DriverListItem
		err := rows.Scan(
			&d.ID, &d.Phone, &d.Name, &d.Surname, &d.Province, &d.District,
			&d.IsActive, &d.CurrentStatus, &d.LastLatitude, &d.LastLongitude, &d.LastLocationAt,
			&d.CreatedAt, &d.VehicleCount,
			&d.AppVersion, &d.DeviceOS, &d.LastActiveAt, &d.AppInstalledAt,
		)
		if err != nil {
			return nil, 0, err
		}
		d.HasApp = d.AppVersion != nil
		drivers = append(drivers, d)
	}

	return drivers, total, nil
}

func (r *DriverRepository) GetActiveDrivers(ctx context.Context) ([]models.Driver, error) {
	query := `
		SELECT id, phone, name, surname, password_hash, province, district, neighborhood,
			home_latitude, home_longitude, fcm_token, is_active, is_phone_verified,
			last_location_at, last_latitude, last_longitude, current_status, created_at, updated_at
		FROM drivers
		WHERE is_active = true AND last_location_at > NOW() - INTERVAL '1 hour'
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drivers []models.Driver
	for rows.Next() {
		var d models.Driver
		err := rows.Scan(
			&d.ID, &d.Phone, &d.Name, &d.Surname, &d.PasswordHash,
			&d.Province, &d.District, &d.Neighborhood,
			&d.HomeLatitude, &d.HomeLongitude, &d.FCMToken,
			&d.IsActive, &d.IsPhoneVerified,
			&d.LastLocationAt, &d.LastLatitude, &d.LastLongitude,
			&d.CurrentStatus, &d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

func (r *DriverRepository) GetDriversWithFCMToken(ctx context.Context) ([]models.Driver, error) {
	query := `
		SELECT id, phone, name, surname, province, district, fcm_token
		FROM drivers
		WHERE is_active = true AND fcm_token IS NOT NULL AND fcm_token != ''
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drivers []models.Driver
	for rows.Next() {
		var d models.Driver
		err := rows.Scan(&d.ID, &d.Phone, &d.Name, &d.Surname, &d.Province, &d.District, &d.FCMToken)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

func (r *DriverRepository) GetStats(ctx context.Context) (total, active, onTrip, atHome int, err error) {
	query := `
		SELECT
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE is_active = true) as active,
			COUNT(*) FILTER (WHERE current_status = 'driving') as on_trip,
			COUNT(*) FILTER (WHERE current_status = 'home') as at_home
		FROM drivers
	`

	err = r.db.Pool.QueryRow(ctx, query).Scan(&total, &active, &onTrip, &atHome)
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("failed to get driver stats: %w", err)
	}

	return total, active, onTrip, atHome, nil
}

// UpdateDeviceInfo - Cihaz ve uygulama bilgilerini günceller
func (r *DriverRepository) UpdateDeviceInfo(ctx context.Context, driverID uuid.UUID, info *models.DeviceInfoRequest) error {
	now := time.Now()

	// İlk kurulum kontrolü
	var appInstalledAt *time.Time
	checkQuery := `SELECT app_installed_at FROM drivers WHERE id = $1`
	r.db.Pool.QueryRow(ctx, checkQuery, driverID).Scan(&appInstalledAt)

	query := `
		UPDATE drivers SET
			app_version = $2,
			app_build_number = $3,
			device_model = $4,
			device_os = $5,
			device_os_version = $6,
			push_enabled = $7,
			location_permission = $8,
			background_location_enabled = $9,
			last_active_at = $10,
			app_installed_at = COALESCE(app_installed_at, $10),
			fcm_token = COALESCE(NULLIF($11, ''), fcm_token),
			updated_at = $10
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		driverID,
		info.AppVersion,
		info.AppBuildNumber,
		info.DeviceModel,
		info.DeviceOS,
		info.DeviceOSVersion,
		info.PushEnabled,
		info.LocationPermission,
		info.BackgroundLocationEnabled,
		now,
		info.FCMToken,
	)

	return err
}

// UpdateLastActive - Son aktif zamanını günceller
func (r *DriverRepository) UpdateLastActive(ctx context.Context, driverID uuid.UUID) error {
	query := `UPDATE drivers SET last_active_at = $2, updated_at = $2 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, driverID, time.Now())
	return err
}

// GetDriverAppStats - Uygulama istatistiklerini getirir
func (r *DriverRepository) GetDriverAppStats(ctx context.Context) (*models.DriverAppStats, error) {
	query := `
		SELECT
			COUNT(*) as total_drivers,
			COUNT(*) FILTER (WHERE app_version IS NOT NULL) as drivers_with_app,
			COUNT(*) FILTER (WHERE device_os = 'ios') as ios_count,
			COUNT(*) FILTER (WHERE device_os = 'android') as android_count,
			COUNT(*) FILTER (WHERE last_active_at > NOW() - INTERVAL '24 hours') as active_last_24h,
			COUNT(*) FILTER (WHERE last_active_at > NOW() - INTERVAL '7 days') as active_last_7d,
			COUNT(*) FILTER (WHERE app_version IS NOT NULL AND last_active_at IS NULL) as never_active,
			COUNT(*) FILTER (WHERE push_enabled = true) as push_enabled_count,
			COUNT(*) FILTER (WHERE background_location_enabled = true) as background_loc_count
		FROM drivers
	`

	var stats models.DriverAppStats
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&stats.TotalDrivers,
		&stats.DriversWithApp,
		&stats.IOSCount,
		&stats.AndroidCount,
		&stats.ActiveLast24h,
		&stats.ActiveLast7d,
		&stats.NeverActive,
		&stats.PushEnabledCount,
		&stats.BackgroundLocCount,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get app stats: %w", err)
	}

	return &stats, nil
}
