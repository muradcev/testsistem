package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
)

type AuditRepository struct {
	db *PostgresDB
}

func NewAuditRepository(db *PostgresDB) *AuditRepository {
	return &AuditRepository{db: db}
}

// Create - Yeni audit log kaydı oluştur
func (r *AuditRepository) Create(ctx context.Context, log *models.AuditLog) error {
	query := `
		INSERT INTO audit_logs (user_id, user_type, user_email, action, resource_type, resource_id, details, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		log.UserID, log.UserType, log.UserEmail, log.Action, log.ResourceType,
		log.ResourceID, log.Details, log.IPAddress, log.UserAgent,
	).Scan(&log.ID, &log.CreatedAt)
}

// LogAction - Kısa yol ile log kaydı oluştur
func (r *AuditRepository) LogAction(ctx context.Context, userID *uuid.UUID, userType, userEmail, action, resourceType string, resourceID *uuid.UUID, details interface{}, ipAddress, userAgent string) error {
	var detailsJSON json.RawMessage
	if details != nil {
		data, err := json.Marshal(details)
		if err == nil {
			detailsJSON = data
		}
	}

	var ipPtr, uaPtr, emailPtr *string
	if ipAddress != "" {
		ipPtr = &ipAddress
	}
	if userAgent != "" {
		uaPtr = &userAgent
	}
	if userEmail != "" {
		emailPtr = &userEmail
	}

	log := &models.AuditLog{
		UserID:       userID,
		UserType:     userType,
		UserEmail:    emailPtr,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      detailsJSON,
		IPAddress:    ipPtr,
		UserAgent:    uaPtr,
	}

	return r.Create(ctx, log)
}

// GetAll - Tüm audit logları getir (pagination ile)
func (r *AuditRepository) GetAll(ctx context.Context, limit, offset int, filters map[string]string) ([]models.AuditLog, int, error) {
	var logs []models.AuditLog
	var total int

	// Build query with filters
	baseQuery := `FROM audit_logs WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if userType, ok := filters["user_type"]; ok && userType != "" {
		baseQuery += fmt.Sprintf(` AND user_type = $%d`, argIndex)
		args = append(args, userType)
		argIndex++
	}

	if action, ok := filters["action"]; ok && action != "" {
		baseQuery += fmt.Sprintf(` AND action = $%d`, argIndex)
		args = append(args, action)
		argIndex++
	}

	if resourceType, ok := filters["resource_type"]; ok && resourceType != "" {
		baseQuery += fmt.Sprintf(` AND resource_type = $%d`, argIndex)
		args = append(args, resourceType)
		argIndex++
	}

	// Count total
	countQuery := `SELECT COUNT(*) ` + baseQuery
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get logs
	selectQuery := fmt.Sprintf(`
		SELECT id, user_id, user_type, user_email, action, resource_type, resource_id, details, ip_address, user_agent, created_at
		%s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, baseQuery, argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var log models.AuditLog
		err := rows.Scan(
			&log.ID, &log.UserID, &log.UserType, &log.UserEmail, &log.Action,
			&log.ResourceType, &log.ResourceID, &log.Details, &log.IPAddress,
			&log.UserAgent, &log.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	return logs, total, nil
}

// GetByUserID - Belirli kullanıcının logları
func (r *AuditRepository) GetByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]models.AuditLog, error) {
	var logs []models.AuditLog

	query := `
		SELECT id, user_id, user_type, user_email, action, resource_type, resource_id, details, ip_address, user_agent, created_at
		FROM audit_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2`

	rows, err := r.db.Pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var log models.AuditLog
		err := rows.Scan(
			&log.ID, &log.UserID, &log.UserType, &log.UserEmail, &log.Action,
			&log.ResourceType, &log.ResourceID, &log.Details, &log.IPAddress,
			&log.UserAgent, &log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, nil
}

// GetStats - Audit log istatistikleri
func (r *AuditRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Son 24 saat işlem sayısı
	var last24h int
	err := r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'
	`).Scan(&last24h)
	if err != nil {
		return nil, err
	}
	stats["last_24h"] = last24h

	// İşlem türüne göre dağılım
	actionStats := make(map[string]int)
	rows, err := r.db.Pool.Query(ctx, `
		SELECT action, COUNT(*) FROM audit_logs
		WHERE created_at > NOW() - INTERVAL '7 days'
		GROUP BY action
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var action string
		var count int
		if err := rows.Scan(&action, &count); err == nil {
			actionStats[action] = count
		}
	}
	stats["by_action"] = actionStats

	// Kaynak türüne göre dağılım
	resourceStats := make(map[string]int)
	rows2, err := r.db.Pool.Query(ctx, `
		SELECT resource_type, COUNT(*) FROM audit_logs
		WHERE created_at > NOW() - INTERVAL '7 days'
		GROUP BY resource_type
	`)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	for rows2.Next() {
		var resourceType string
		var count int
		if err := rows2.Scan(&resourceType, &count); err == nil {
			resourceStats[resourceType] = count
		}
	}
	stats["by_resource"] = resourceStats

	return stats, nil
}

// DeleteOldLogs - Eski logları sil (retention policy)
func (r *AuditRepository) DeleteOldLogs(ctx context.Context, daysToKeep int) (int64, error) {
	result, err := r.db.Pool.Exec(ctx, `
		DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 day' * $1
	`, daysToKeep)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
