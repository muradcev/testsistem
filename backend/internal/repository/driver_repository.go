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
			contacts_permission, phone_permission, call_log_permission, notification_permission,
			COALESCE(contacts_enabled, true), COALESCE(call_log_enabled, true),
			COALESCE(surveys_enabled, true), COALESCE(questions_enabled, true),
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
		&driver.ContactsPermission, &driver.PhonePermission, &driver.CallLogPermission, &driver.NotificationPermission,
		&driver.ContactsEnabled, &driver.CallLogEnabled, &driver.SurveysEnabled, &driver.QuestionsEnabled,
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
			contacts_permission, phone_permission, call_log_permission, notification_permission,
			COALESCE(contacts_enabled, true), COALESCE(call_log_enabled, true),
			COALESCE(surveys_enabled, true), COALESCE(questions_enabled, true),
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
		&driver.ContactsPermission, &driver.PhonePermission, &driver.CallLogPermission, &driver.NotificationPermission,
		&driver.ContactsEnabled, &driver.CallLogEnabled, &driver.SurveysEnabled, &driver.QuestionsEnabled,
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

func (r *DriverRepository) UpdateLocation(ctx context.Context, driverID uuid.UUID, lat, lng float64, status, province, district string) error {
	query := `
		UPDATE drivers SET
			last_latitude = $2, last_longitude = $3, last_location_at = $4,
			current_status = $5,
			province = COALESCE(NULLIF($6, ''), province),
			district = COALESCE(NULLIF($7, ''), district),
			updated_at = $4
		WHERE id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, driverID, lat, lng, time.Now(), status, province, district)
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
			d.app_version, d.device_os, d.last_active_at, d.app_installed_at,
			d.push_enabled, (d.fcm_token IS NOT NULL AND d.fcm_token != '') as has_fcm_token
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
			&d.PushEnabled, &d.HasFCMToken,
		)
		if err != nil {
			return nil, 0, err
		}
		d.HasApp = d.AppVersion != nil
		d.Status = models.MapDriverStatusWithTime(d.CurrentStatus, d.IsActive, d.LastLocationAt)
		d.AppStatus = models.GetAppStatus(d.LastActiveAt, d.HasApp)
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
	// on_trip: son 1 saat içinde konum gönderen VE son 1 saatte en az 1km hareket eden şoförler
	// at_home: son 1 saat içinde konum gönderen ve home durumunda olanlar
	query := `
		WITH recent_distance AS (
			-- Her şoför için son 1 saatteki toplam mesafeyi hesapla
			SELECT
				driver_id,
				COALESCE(SUM(
					-- Haversine formülü ile ardışık noktalar arası mesafe (metre)
					6371000 * 2 * ASIN(SQRT(
						POWER(SIN(RADIANS(latitude - prev_lat) / 2), 2) +
						COS(RADIANS(prev_lat)) * COS(RADIANS(latitude)) *
						POWER(SIN(RADIANS(longitude - prev_lng) / 2), 2)
					))
				), 0) as total_distance
			FROM (
				SELECT
					driver_id,
					latitude,
					longitude,
					LAG(latitude) OVER (PARTITION BY driver_id ORDER BY recorded_at) as prev_lat,
					LAG(longitude) OVER (PARTITION BY driver_id ORDER BY recorded_at) as prev_lng
				FROM locations
				WHERE recorded_at > NOW() - INTERVAL '1 hour'
			) sub
			WHERE prev_lat IS NOT NULL
			GROUP BY driver_id
		)
		SELECT
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE d.is_active = true) as active,
			COUNT(*) FILTER (WHERE
				d.last_location_at > NOW() - INTERVAL '1 hour'
				AND COALESCE(rd.total_distance, 0) >= 1000
			) as on_trip,
			COUNT(*) FILTER (WHERE
				d.current_status = 'home'
				AND d.last_location_at > NOW() - INTERVAL '1 hour'
			) as at_home
		FROM drivers d
		LEFT JOIN recent_distance rd ON d.id = rd.driver_id
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
			contacts_permission = COALESCE(NULLIF($12, ''), contacts_permission),
			phone_permission = COALESCE(NULLIF($13, ''), phone_permission),
			call_log_permission = COALESCE(NULLIF($14, ''), call_log_permission),
			notification_permission = COALESCE(NULLIF($15, ''), notification_permission),
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
		info.ContactsPermission,
		info.PhonePermission,
		info.CallLogPermission,
		info.NotificationPermission,
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

// UpdateStatus - Sürücü aktif/pasif durumunu güncelle
func (r *DriverRepository) UpdateStatus(ctx context.Context, driverID uuid.UUID, isActive bool) error {
	query := `UPDATE drivers SET is_active = $1, updated_at = $2 WHERE id = $3`
	_, err := r.db.Pool.Exec(ctx, query, isActive, time.Now(), driverID)
	return err
}

// UpdateFeatures - Sürücü özelliklerini güncelle
func (r *DriverRepository) UpdateFeatures(ctx context.Context, driverID uuid.UUID, features map[string]bool) error {
	// Dinamik SQL oluştur
	setClauses := "updated_at = $1"
	args := []interface{}{time.Now()}
	argIndex := 2

	for key, value := range features {
		switch key {
		case "location_tracking_enabled":
			setClauses += fmt.Sprintf(", location_permission = $%d", argIndex)
			if value {
				args = append(args, "always")
			} else {
				args = append(args, "denied")
			}
			argIndex++
		case "background_location_enabled":
			setClauses += fmt.Sprintf(", background_location_enabled = $%d", argIndex)
			args = append(args, value)
			argIndex++
		case "notifications_enabled":
			setClauses += fmt.Sprintf(", push_enabled = $%d", argIndex)
			args = append(args, value)
			argIndex++
		case "surveys_enabled":
			setClauses += fmt.Sprintf(", surveys_enabled = $%d", argIndex)
			args = append(args, value)
			argIndex++
		case "questions_enabled":
			setClauses += fmt.Sprintf(", questions_enabled = $%d", argIndex)
			args = append(args, value)
			argIndex++
		case "contacts_enabled":
			setClauses += fmt.Sprintf(", contacts_enabled = $%d", argIndex)
			args = append(args, value)
			argIndex++
		case "call_log_enabled":
			setClauses += fmt.Sprintf(", call_log_enabled = $%d", argIndex)
			args = append(args, value)
			argIndex++
		}
	}

	args = append(args, driverID)
	query := fmt.Sprintf("UPDATE drivers SET %s WHERE id = $%d", setClauses, argIndex)

	_, err := r.db.Pool.Exec(ctx, query, args...)
	return err
}

// Delete - Sürücüyü sil (CASCADE ile ilişkili veriler de silinir)
func (r *DriverRepository) Delete(ctx context.Context, driverID uuid.UUID) error {
	query := `DELETE FROM drivers WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, driverID)
	return err
}

// ==================== CALL LOGS ====================

// GetDriverCallLogs - Sürücünün arama geçmişini getir
func (r *DriverRepository) GetDriverCallLogs(ctx context.Context, driverID uuid.UUID, limit, offset int) ([]models.DriverCallLog, int, error) {
	// Toplam sayı
	var total int
	countQuery := `SELECT COUNT(*) FROM driver_call_logs WHERE driver_id = $1`
	err := r.db.Pool.QueryRow(ctx, countQuery, driverID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count call logs: %w", err)
	}

	query := `
		SELECT id, driver_id, phone_number, contact_name, call_type,
		       duration_seconds, call_timestamp, delivery_id, synced_at, created_at
		FROM driver_call_logs
		WHERE driver_id = $1
		ORDER BY call_timestamp DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get call logs: %w", err)
	}
	defer rows.Close()

	var logs []models.DriverCallLog
	for rows.Next() {
		var log models.DriverCallLog
		err := rows.Scan(
			&log.ID, &log.DriverID, &log.PhoneNumber, &log.ContactName, &log.CallType,
			&log.DurationSeconds, &log.CallTimestamp, &log.DeliveryID, &log.SyncedAt, &log.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan call log: %w", err)
		}
		logs = append(logs, log)
	}

	return logs, total, nil
}

// DeleteDriverCallLogs - Sürücünün tüm arama geçmişini sil
func (r *DriverRepository) DeleteDriverCallLogs(ctx context.Context, driverID uuid.UUID) (int64, error) {
	query := `DELETE FROM driver_call_logs WHERE driver_id = $1`
	result, err := r.db.Pool.Exec(ctx, query, driverID)
	if err != nil {
		return 0, fmt.Errorf("failed to delete call logs: %w", err)
	}
	return result.RowsAffected(), nil
}

// DeleteCallLog - Tek bir arama kaydını sil
func (r *DriverRepository) DeleteCallLog(ctx context.Context, logID uuid.UUID) error {
	query := `DELETE FROM driver_call_logs WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, logID)
	return err
}

// GetCallLogStats - Sürücü arama istatistikleri
func (r *DriverRepository) GetCallLogStats(ctx context.Context, driverID uuid.UUID) (*models.CallLogStats, error) {
	query := `
		SELECT
			COUNT(*) as total_calls,
			COUNT(CASE WHEN call_type = 'outgoing' THEN 1 END) as outgoing_calls,
			COUNT(CASE WHEN call_type = 'incoming' THEN 1 END) as incoming_calls,
			COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed_calls,
			COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
			COUNT(DISTINCT phone_number) as unique_contacts,
			MAX(call_timestamp) as last_call_at
		FROM driver_call_logs
		WHERE driver_id = $1
	`

	var stats models.CallLogStats
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(
		&stats.TotalCalls,
		&stats.OutgoingCalls,
		&stats.IncomingCalls,
		&stats.MissedCalls,
		&stats.TotalDurationSeconds,
		&stats.UniqueContacts,
		&stats.LastCallAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get call log stats: %w", err)
	}

	return &stats, nil
}

// ==================== CONTACTS ====================

// GetDriverContacts - Sürücünün rehberini getir
func (r *DriverRepository) GetDriverContacts(ctx context.Context, driverID uuid.UUID, limit, offset int) ([]models.DriverContact, int, error) {
	// Toplam sayı
	var total int
	countQuery := `SELECT COUNT(*) FROM driver_contacts WHERE driver_id = $1 AND is_deleted = false`
	err := r.db.Pool.QueryRow(ctx, countQuery, driverID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count contacts: %w", err)
	}

	query := `
		SELECT id, driver_id, contact_id, name, phone_numbers, contact_type,
		       synced_at, is_deleted, created_at, updated_at
		FROM driver_contacts
		WHERE driver_id = $1 AND is_deleted = false
		ORDER BY name ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get contacts: %w", err)
	}
	defer rows.Close()

	var contacts []models.DriverContact
	for rows.Next() {
		var contact models.DriverContact
		err := rows.Scan(
			&contact.ID, &contact.DriverID, &contact.ContactID, &contact.Name, &contact.PhoneNumbers,
			&contact.ContactType, &contact.SyncedAt, &contact.IsDeleted, &contact.CreatedAt, &contact.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan contact: %w", err)
		}
		contacts = append(contacts, contact)
	}

	return contacts, total, nil
}

// DeleteDriverContacts - Sürücünün tüm rehberini sil
func (r *DriverRepository) DeleteDriverContacts(ctx context.Context, driverID uuid.UUID) (int64, error) {
	query := `DELETE FROM driver_contacts WHERE driver_id = $1`
	result, err := r.db.Pool.Exec(ctx, query, driverID)
	if err != nil {
		return 0, fmt.Errorf("failed to delete contacts: %w", err)
	}
	return result.RowsAffected(), nil
}

// DeleteContact - Tek bir kişiyi sil
func (r *DriverRepository) DeleteContact(ctx context.Context, contactID uuid.UUID) error {
	query := `DELETE FROM driver_contacts WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, contactID)
	return err
}

// DeleteContactsBulk - Birden fazla kişiyi toplu sil
func (r *DriverRepository) DeleteContactsBulk(ctx context.Context, contactIDs []uuid.UUID) (int64, error) {
	if len(contactIDs) == 0 {
		return 0, nil
	}

	query := `DELETE FROM driver_contacts WHERE id = ANY($1)`
	result, err := r.db.Pool.Exec(ctx, query, contactIDs)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// GetContactStats - Sürücü rehber istatistikleri
func (r *DriverRepository) GetContactStats(ctx context.Context, driverID uuid.UUID) (*models.ContactStats, error) {
	query := `
		SELECT
			COUNT(*) as total_contacts,
			COUNT(CASE WHEN contact_type = 'customer' THEN 1 END) as customer_contacts,
			COUNT(CASE WHEN contact_type = 'broker' THEN 1 END) as broker_contacts,
			COUNT(CASE WHEN contact_type = 'colleague' THEN 1 END) as colleague_contacts,
			COUNT(CASE WHEN contact_type = 'family' THEN 1 END) as family_contacts,
			MAX(synced_at) as last_sync_at
		FROM driver_contacts
		WHERE driver_id = $1 AND is_deleted = false
	`

	var stats models.ContactStats
	err := r.db.Pool.QueryRow(ctx, query, driverID).Scan(
		&stats.TotalContacts,
		&stats.CustomerContacts,
		&stats.BrokerContacts,
		&stats.ColleagueContacts,
		&stats.FamilyContacts,
		&stats.LastSyncAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get contact stats: %w", err)
	}

	return &stats, nil
}

// SaveCallLogs - Arama geçmişini kaydet (upsert)
func (r *DriverRepository) SaveCallLogs(ctx context.Context, driverID uuid.UUID, logs []models.CallLogSyncItem) (int, error) {
	if len(logs) == 0 {
		return 0, nil
	}

	query := `
		INSERT INTO driver_call_logs (id, driver_id, phone_number, contact_name, call_type, duration_seconds, call_timestamp, synced_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (driver_id, phone_number, call_timestamp) DO UPDATE SET
			contact_name = EXCLUDED.contact_name,
			duration_seconds = EXCLUDED.duration_seconds,
			synced_at = NOW()
	`

	inserted := 0
	for _, log := range logs {
		_, err := r.db.Pool.Exec(ctx, query,
			uuid.New(), driverID, log.PhoneNumber, log.ContactName, log.CallType,
			log.DurationSeconds, log.Timestamp,
		)
		if err != nil {
			// Log error but continue with other entries
			continue
		}
		inserted++
	}

	return inserted, nil
}

// SaveContacts - Rehberi kaydet (upsert)
func (r *DriverRepository) SaveContacts(ctx context.Context, driverID uuid.UUID, contacts []models.ContactSyncItem) (int, error) {
	if len(contacts) == 0 {
		return 0, nil
	}

	query := `
		INSERT INTO driver_contacts (id, driver_id, contact_id, name, phone_numbers, contact_type, synced_at, is_deleted, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, NOW(), NOW())
		ON CONFLICT (driver_id, contact_id) DO UPDATE SET
			name = EXCLUDED.name,
			phone_numbers = EXCLUDED.phone_numbers,
			contact_type = EXCLUDED.contact_type,
			synced_at = NOW(),
			updated_at = NOW(),
			is_deleted = false
	`

	inserted := 0
	for _, contact := range contacts {
		_, err := r.db.Pool.Exec(ctx, query,
			uuid.New(), driverID, contact.ContactID, contact.Name, contact.PhoneNumbers, contact.ContactType,
		)
		if err != nil {
			// Log error but continue with other entries
			continue
		}
		inserted++
	}

	return inserted, nil
}

// ==================== SURVEY/QUESTION RESPONSES ====================

// GetDriverSurveyResponses - Sürücünün anket cevaplarını getir
func (r *DriverRepository) GetDriverSurveyResponses(ctx context.Context, driverID uuid.UUID, limit int) ([]models.DriverSurveyResponse, error) {
	query := `
		SELECT sr.id, sr.survey_id, s.title as survey_title, s.trigger_type as survey_type,
		       sr.answer, sr.answered_at
		FROM survey_responses sr
		JOIN surveys s ON sr.survey_id = s.id
		WHERE sr.driver_id = $1
		ORDER BY sr.answered_at DESC
		LIMIT $2
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get survey responses: %w", err)
	}
	defer rows.Close()

	var responses []models.DriverSurveyResponse
	for rows.Next() {
		var resp models.DriverSurveyResponse
		err := rows.Scan(&resp.ID, &resp.SurveyID, &resp.SurveyTitle, &resp.SurveyType, &resp.Answer, &resp.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan survey response: %w", err)
		}
		responses = append(responses, resp)
	}

	return responses, nil
}

// GetDriverQuestionResponses - Sürücünün soru cevaplarını getir
func (r *DriverRepository) GetDriverQuestionResponses(ctx context.Context, driverID uuid.UUID, limit int) ([]models.DriverQuestionResponse, error) {
	query := `
		SELECT dq.id, dq.question_text, dq.question_type, dqa.answer_value,
		       dq.options, dqa.follow_up_answers, dq.status, dqa.answered_at, dq.created_at
		FROM driver_questions dq
		LEFT JOIN driver_question_answers dqa ON dq.id = dqa.question_id
		WHERE dq.driver_id = $1 AND dq.status IN ('answered', 'sent')
		ORDER BY COALESCE(dqa.answered_at, dq.created_at) DESC
		LIMIT $2
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get question responses: %w", err)
	}
	defer rows.Close()

	var responses []models.DriverQuestionResponse
	for rows.Next() {
		var resp models.DriverQuestionResponse
		err := rows.Scan(
			&resp.ID, &resp.QuestionText, &resp.QuestionType, &resp.AnswerText,
			&resp.AnswerOptions, &resp.AnswerData, &resp.Status, &resp.AnsweredAt, &resp.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan question response: %w", err)
		}
		responses = append(responses, resp)
	}

	return responses, nil
}

// DeleteDriverSurveyResponses - Sürücünün tüm anket cevaplarını sil
func (r *DriverRepository) DeleteDriverSurveyResponses(ctx context.Context, driverID uuid.UUID) (int64, error) {
	query := `DELETE FROM survey_responses WHERE driver_id = $1`
	result, err := r.db.Pool.Exec(ctx, query, driverID)
	if err != nil {
		return 0, fmt.Errorf("failed to delete survey responses: %w", err)
	}
	return result.RowsAffected(), nil
}

// DeleteDriverQuestionResponses - Sürücünün tüm soru cevaplarını sil
func (r *DriverRepository) DeleteDriverQuestionResponses(ctx context.Context, driverID uuid.UUID) (int64, error) {
	// Önce cevapları sil
	_, err := r.db.Pool.Exec(ctx, `
		DELETE FROM driver_question_answers
		WHERE question_id IN (SELECT id FROM driver_questions WHERE driver_id = $1)
	`, driverID)
	if err != nil {
		return 0, fmt.Errorf("failed to delete question answers: %w", err)
	}

	// Sonra soruları sil
	query := `DELETE FROM driver_questions WHERE driver_id = $1`
	result, err := r.db.Pool.Exec(ctx, query, driverID)
	if err != nil {
		return 0, fmt.Errorf("failed to delete questions: %w", err)
	}
	return result.RowsAffected(), nil
}

// ==================== ALL CALL LOGS & CONTACTS ====================

// GetAllCallLogs - Tüm şoförlerin arama geçmişini getir
func (r *DriverRepository) GetAllCallLogs(ctx context.Context, limit, offset int, driverID *uuid.UUID, callType string) ([]models.AllDriverCallLog, int, error) {
	// Toplam sayı
	var total int
	countArgs := []interface{}{}
	countQuery := `SELECT COUNT(*) FROM driver_call_logs cl JOIN drivers d ON cl.driver_id = d.id WHERE 1=1`
	argIdx := 1

	if driverID != nil {
		countQuery += fmt.Sprintf(" AND cl.driver_id = $%d", argIdx)
		countArgs = append(countArgs, *driverID)
		argIdx++
	}
	if callType != "" {
		countQuery += fmt.Sprintf(" AND cl.call_type = $%d", argIdx)
		countArgs = append(countArgs, callType)
		argIdx++
	}

	err := r.db.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count all call logs: %w", err)
	}

	query := `
		SELECT cl.id, cl.driver_id, d.name || ' ' || d.surname as driver_name, d.phone as driver_phone,
		       cl.phone_number, cl.contact_name, cl.call_type, cl.duration_seconds,
		       cl.call_timestamp, cl.synced_at, cl.created_at
		FROM driver_call_logs cl
		JOIN drivers d ON cl.driver_id = d.id
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx = 1

	if driverID != nil {
		query += fmt.Sprintf(" AND cl.driver_id = $%d", argIdx)
		args = append(args, *driverID)
		argIdx++
	}
	if callType != "" {
		query += fmt.Sprintf(" AND cl.call_type = $%d", argIdx)
		args = append(args, callType)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY cl.call_timestamp DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get all call logs: %w", err)
	}
	defer rows.Close()

	var logs []models.AllDriverCallLog
	for rows.Next() {
		var log models.AllDriverCallLog
		err := rows.Scan(
			&log.ID, &log.DriverID, &log.DriverName, &log.DriverPhone,
			&log.PhoneNumber, &log.ContactName, &log.CallType, &log.DurationSeconds,
			&log.CallTimestamp, &log.SyncedAt, &log.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan call log: %w", err)
		}
		logs = append(logs, log)
	}

	return logs, total, nil
}

// GetAllCallLogsStats - Tüm arama istatistikleri
func (r *DriverRepository) GetAllCallLogsStats(ctx context.Context) (*models.AllCallLogStats, error) {
	query := `
		SELECT
			COUNT(*) as total_calls,
			COUNT(CASE WHEN call_type = 'outgoing' THEN 1 END) as outgoing_calls,
			COUNT(CASE WHEN call_type = 'incoming' THEN 1 END) as incoming_calls,
			COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed_calls,
			COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
			COUNT(DISTINCT driver_id) as total_drivers,
			COUNT(DISTINCT phone_number) as unique_contacts
		FROM driver_call_logs
	`

	var stats models.AllCallLogStats
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&stats.TotalCalls,
		&stats.OutgoingCalls,
		&stats.IncomingCalls,
		&stats.MissedCalls,
		&stats.TotalDurationSeconds,
		&stats.TotalDrivers,
		&stats.UniqueContacts,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get all call log stats: %w", err)
	}

	return &stats, nil
}

// GetAllContacts - Tüm şoförlerin rehberini getir
func (r *DriverRepository) GetAllContacts(ctx context.Context, limit, offset int, driverID *uuid.UUID, search string) ([]models.AllDriverContact, int, error) {
	// Toplam sayı
	var total int
	countArgs := []interface{}{}
	countQuery := `SELECT COUNT(*) FROM driver_contacts dc JOIN drivers d ON dc.driver_id = d.id WHERE dc.is_deleted = false`
	argIdx := 1

	if driverID != nil {
		countQuery += fmt.Sprintf(" AND dc.driver_id = $%d", argIdx)
		countArgs = append(countArgs, *driverID)
		argIdx++
	}
	if search != "" {
		countQuery += fmt.Sprintf(" AND (dc.name ILIKE $%d OR dc.phone_numbers::text ILIKE $%d)", argIdx, argIdx)
		countArgs = append(countArgs, "%"+search+"%")
		argIdx++
	}

	err := r.db.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count all contacts: %w", err)
	}

	query := `
		SELECT dc.id, dc.driver_id, d.name || ' ' || d.surname as driver_name, d.phone as driver_phone,
		       dc.contact_id, dc.name, dc.phone_numbers, dc.contact_type,
		       dc.synced_at, dc.created_at
		FROM driver_contacts dc
		JOIN drivers d ON dc.driver_id = d.id
		WHERE dc.is_deleted = false
	`
	args := []interface{}{}
	argIdx = 1

	if driverID != nil {
		query += fmt.Sprintf(" AND dc.driver_id = $%d", argIdx)
		args = append(args, *driverID)
		argIdx++
	}
	if search != "" {
		query += fmt.Sprintf(" AND (dc.name ILIKE $%d OR dc.phone_numbers::text ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY dc.name ASC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get all contacts: %w", err)
	}
	defer rows.Close()

	var contacts []models.AllDriverContact
	for rows.Next() {
		var contact models.AllDriverContact
		err := rows.Scan(
			&contact.ID, &contact.DriverID, &contact.DriverName, &contact.DriverPhone,
			&contact.ContactID, &contact.Name, &contact.PhoneNumbers, &contact.ContactType,
			&contact.SyncedAt, &contact.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan contact: %w", err)
		}
		contacts = append(contacts, contact)
	}

	return contacts, total, nil
}

// GetAllContactsStats - Tüm rehber istatistikleri
func (r *DriverRepository) GetAllContactsStats(ctx context.Context) (*models.AllContactStats, error) {
	query := `
		SELECT
			COUNT(*) as total_contacts,
			COUNT(DISTINCT driver_id) as total_drivers,
			COUNT(CASE WHEN contact_type = 'customer' THEN 1 END) as customer_contacts,
			COUNT(CASE WHEN contact_type = 'broker' THEN 1 END) as broker_contacts,
			COUNT(CASE WHEN contact_type = 'colleague' THEN 1 END) as colleague_contacts,
			COUNT(CASE WHEN contact_type = 'family' THEN 1 END) as family_contacts
		FROM driver_contacts
		WHERE is_deleted = false
	`

	var stats models.AllContactStats
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&stats.TotalContacts,
		&stats.TotalDrivers,
		&stats.CustomerContacts,
		&stats.BrokerContacts,
		&stats.ColleagueContacts,
		&stats.FamilyContacts,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get all contact stats: %w", err)
	}

	return &stats, nil
}
