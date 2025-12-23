package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
)

type AppLogRepository struct {
	db PgxPool
}

func NewAppLogRepository(db *PostgresDB) *AppLogRepository {
	return &AppLogRepository{db: db.Pool}
}

// CreateTable - Tabloyu oluştur (migration için)
func (r *AppLogRepository) CreateTable(ctx context.Context) error {
	query := `
	CREATE TABLE IF NOT EXISTS app_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
		level VARCHAR(20) NOT NULL,
		category VARCHAR(30) NOT NULL,
		message TEXT NOT NULL,
		stack_trace TEXT,
		metadata JSONB,
		screen VARCHAR(100),
		action VARCHAR(100),
		device_id VARCHAR(100),
		device_model VARCHAR(100),
		os_version VARCHAR(50),
		app_version VARCHAR(20),
		build_number VARCHAR(20),
		client_time TIMESTAMPTZ NOT NULL,
		server_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Indexes for common queries
	CREATE INDEX IF NOT EXISTS idx_app_logs_driver_id ON app_logs(driver_id);
	CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
	CREATE INDEX IF NOT EXISTS idx_app_logs_category ON app_logs(category);
	CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_app_logs_device_id ON app_logs(device_id);
	CREATE INDEX IF NOT EXISTS idx_app_logs_level_created ON app_logs(level, created_at DESC);
	`
	_, err := r.db.Exec(ctx, query)
	return err
}

// SaveBatch - Toplu log kaydet
func (r *AppLogRepository) SaveBatch(ctx context.Context, logs []models.AppLog) error {
	if len(logs) == 0 {
		return nil
	}

	// Batch insert query
	valueStrings := make([]string, 0, len(logs))
	valueArgs := make([]interface{}, 0, len(logs)*14)

	for i, log := range logs {
		base := i * 14
		valueStrings = append(valueStrings, fmt.Sprintf(
			"($%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7,
			base+8, base+9, base+10, base+11, base+12, base+13, base+14,
		))

		metadataJSON, _ := json.Marshal(log.Metadata)

		valueArgs = append(valueArgs,
			log.ID,
			log.DriverID,
			log.Level,
			log.Category,
			log.Message,
			log.StackTrace,
			metadataJSON,
			log.Screen,
			log.Action,
			log.DeviceID,
			log.DeviceModel,
			log.OSVersion,
			log.AppVersion,
			log.ClientTime,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO app_logs (
			id, driver_id, level, category, message, stack_trace, metadata,
			screen, action, device_id, device_model, os_version, app_version, client_time
		) VALUES %s
	`, strings.Join(valueStrings, ", "))

	_, err := r.db.Exec(ctx, query, valueArgs...)
	return err
}

// Save - Tek log kaydet
func (r *AppLogRepository) Save(ctx context.Context, log *models.AppLog) error {
	metadataJSON, _ := json.Marshal(log.Metadata)

	query := `
		INSERT INTO app_logs (
			id, driver_id, level, category, message, stack_trace, metadata,
			screen, action, device_id, device_model, os_version, app_version, client_time
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := r.db.Exec(ctx, query,
		log.ID,
		log.DriverID,
		log.Level,
		log.Category,
		log.Message,
		log.StackTrace,
		metadataJSON,
		log.Screen,
		log.Action,
		log.DeviceID,
		log.DeviceModel,
		log.OSVersion,
		log.AppVersion,
		log.ClientTime,
	)
	return err
}

// GetByFilter - Filtreye göre log getir
func (r *AppLogRepository) GetByFilter(ctx context.Context, filter models.AppLogFilter) ([]models.AppLog, int64, error) {
	// Base query
	baseQuery := `FROM app_logs WHERE 1=1`
	args := make([]interface{}, 0)
	argIndex := 1

	// Filters
	if filter.DriverID != nil {
		baseQuery += fmt.Sprintf(" AND driver_id = $%d", argIndex)
		args = append(args, *filter.DriverID)
		argIndex++
	}

	if filter.Level != nil {
		baseQuery += fmt.Sprintf(" AND level = $%d", argIndex)
		args = append(args, *filter.Level)
		argIndex++
	}

	if filter.Category != nil {
		baseQuery += fmt.Sprintf(" AND category = $%d", argIndex)
		args = append(args, *filter.Category)
		argIndex++
	}

	if filter.StartTime != nil {
		baseQuery += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, *filter.StartTime)
		argIndex++
	}

	if filter.EndTime != nil {
		baseQuery += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, *filter.EndTime)
		argIndex++
	}

	if filter.Search != nil && *filter.Search != "" {
		baseQuery += fmt.Sprintf(" AND (message ILIKE $%d OR stack_trace ILIKE $%d)", argIndex, argIndex+1)
		searchTerm := "%" + *filter.Search + "%"
		args = append(args, searchTerm, searchTerm)
		argIndex += 2
	}

	// Count query
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Data query
	limit := 100
	if filter.Limit > 0 && filter.Limit <= 500 {
		limit = filter.Limit
	}

	dataQuery := fmt.Sprintf(`
		SELECT id, driver_id, level, category, message, stack_trace, metadata,
			   screen, action, device_id, device_model, os_version, app_version,
			   build_number, client_time, server_time, created_at
		%s ORDER BY created_at DESC LIMIT $%d OFFSET $%d
	`, baseQuery, argIndex, argIndex+1)
	args = append(args, limit, filter.Offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	logs := make([]models.AppLog, 0)
	for rows.Next() {
		var log models.AppLog
		var metadataJSON []byte

		err := rows.Scan(
			&log.ID,
			&log.DriverID,
			&log.Level,
			&log.Category,
			&log.Message,
			&log.StackTrace,
			&metadataJSON,
			&log.Screen,
			&log.Action,
			&log.DeviceID,
			&log.DeviceModel,
			&log.OSVersion,
			&log.AppVersion,
			&log.BuildNumber,
			&log.ClientTime,
			&log.ServerTime,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if metadataJSON != nil {
			json.Unmarshal(metadataJSON, &log.Metadata)
		}

		logs = append(logs, log)
	}

	return logs, total, nil
}

// GetStats - Log istatistiklerini getir
func (r *AppLogRepository) GetStats(ctx context.Context, driverID *uuid.UUID) (*models.AppLogStats, error) {
	stats := &models.AppLogStats{
		ByLevel:    make(map[string]int64),
		ByCategory: make(map[string]int64),
		ByDevice:   make(map[string]int64),
	}

	// Driver filter
	driverFilter := ""
	args := make([]interface{}, 0)
	if driverID != nil {
		driverFilter = " WHERE driver_id = $1"
		args = append(args, *driverID)
	}

	// Total count
	totalQuery := "SELECT COUNT(*) FROM app_logs" + driverFilter
	r.db.QueryRow(ctx, totalQuery, args...).Scan(&stats.TotalLogs)

	// Error count
	if driverID != nil {
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE level = 'error' AND driver_id = $1", *driverID).Scan(&stats.ErrorCount)
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE level = 'critical' AND driver_id = $1", *driverID).Scan(&stats.CriticalCount)
	} else {
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE level = 'error'").Scan(&stats.ErrorCount)
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE level = 'critical'").Scan(&stats.CriticalCount)
	}

	// By level
	levelQuery := "SELECT level, COUNT(*) FROM app_logs" + driverFilter + " GROUP BY level"
	rows, _ := r.db.Query(ctx, levelQuery, args...)
	for rows.Next() {
		var level string
		var count int64
		rows.Scan(&level, &count)
		stats.ByLevel[level] = count
	}
	rows.Close()

	// By category
	catQuery := "SELECT category, COUNT(*) FROM app_logs" + driverFilter + " GROUP BY category"
	rows, _ = r.db.Query(ctx, catQuery, args...)
	for rows.Next() {
		var cat string
		var count int64
		rows.Scan(&cat, &count)
		stats.ByCategory[cat] = count
	}
	rows.Close()

	// Last 24 hours
	last24h := time.Now().Add(-24 * time.Hour)
	if driverID != nil {
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE created_at >= $1 AND driver_id = $2", last24h, *driverID).Scan(&stats.Last24Hours)
	} else {
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE created_at >= $1", last24h).Scan(&stats.Last24Hours)
	}

	// Last 7 days
	last7d := time.Now().Add(-7 * 24 * time.Hour)
	if driverID != nil {
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE created_at >= $1 AND driver_id = $2", last7d, *driverID).Scan(&stats.Last7Days)
	} else {
		r.db.QueryRow(ctx, "SELECT COUNT(*) FROM app_logs WHERE created_at >= $1", last7d).Scan(&stats.Last7Days)
	}

	// By device (top 10)
	deviceQuery := `
		SELECT COALESCE(device_model, 'Unknown'), COUNT(*)
		FROM app_logs ` + driverFilter + `
		GROUP BY device_model
		ORDER BY COUNT(*) DESC
		LIMIT 10`
	rows, _ = r.db.Query(ctx, deviceQuery, args...)
	for rows.Next() {
		var device string
		var count int64
		rows.Scan(&device, &count)
		stats.ByDevice[device] = count
	}
	rows.Close()

	return stats, nil
}

// DeleteOld - Eski logları sil (retention policy)
func (r *AppLogRepository) DeleteOld(ctx context.Context, olderThan time.Time) (int64, error) {
	result, err := r.db.Exec(ctx, "DELETE FROM app_logs WHERE created_at < $1", olderThan)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// GetByDriverID - Driver'a ait logları getir
func (r *AppLogRepository) GetByDriverID(ctx context.Context, driverID uuid.UUID, limit, offset int) ([]models.AppLog, int64, error) {
	filter := models.AppLogFilter{
		DriverID: &driverID,
		Limit:    limit,
		Offset:   offset,
	}
	return r.GetByFilter(ctx, filter)
}

// GetErrors - Sadece hata loglarını getir
func (r *AppLogRepository) GetErrors(ctx context.Context, limit, offset int) ([]models.AppLog, int64, error) {
	errorLevel := models.LogLevelError
	filter := models.AppLogFilter{
		Level:  &errorLevel,
		Limit:  limit,
		Offset: offset,
	}
	return r.GetByFilter(ctx, filter)
}

// GetCritical - Kritik logları getir
func (r *AppLogRepository) GetCritical(ctx context.Context, limit, offset int) ([]models.AppLog, int64, error) {
	criticalLevel := models.LogLevelCritical
	filter := models.AppLogFilter{
		Level:  &criticalLevel,
		Limit:  limit,
		Offset: offset,
	}
	return r.GetByFilter(ctx, filter)
}
