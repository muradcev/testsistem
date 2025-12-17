package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
)

type AnnouncementRepository struct {
	db *PostgresDB
}

func NewAnnouncementRepository(db *PostgresDB) *AnnouncementRepository {
	return &AnnouncementRepository{db: db}
}

// Create - Yeni duyuru oluştur
func (r *AnnouncementRepository) Create(ctx context.Context, req *models.AnnouncementCreateRequest, createdBy uuid.UUID) (*models.Announcement, error) {
	announcement := &models.Announcement{
		Title:         req.Title,
		Content:       req.Content,
		ImageURL:      req.ImageURL,
		LinkURL:       req.LinkURL,
		LinkText:      req.LinkText,
		Type:          req.Type,
		Priority:      req.Priority,
		IsActive:      true,
		IsDismissable: req.IsDismissable,
		StartAt:       req.StartAt,
		EndAt:         req.EndAt,
		TargetType:    req.TargetType,
		TargetData:    req.TargetData,
		CreatedBy:     createdBy,
	}

	query := `
		INSERT INTO announcements (title, content, image_url, link_url, link_text, type, priority, is_active, is_dismissable, start_at, end_at, target_type, target_data, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at`

	var targetDataJSON interface{}
	if req.TargetData != nil {
		targetDataJSON = *req.TargetData
	}

	err := r.db.Pool.QueryRow(ctx, query,
		announcement.Title,
		announcement.Content,
		announcement.ImageURL,
		announcement.LinkURL,
		announcement.LinkText,
		announcement.Type,
		announcement.Priority,
		announcement.IsActive,
		announcement.IsDismissable,
		announcement.StartAt,
		announcement.EndAt,
		announcement.TargetType,
		targetDataJSON,
		announcement.CreatedBy,
	).Scan(&announcement.ID, &announcement.CreatedAt, &announcement.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return announcement, nil
}

// GetByID - ID ile duyuru getir
func (r *AnnouncementRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Announcement, error) {
	var announcement models.Announcement
	var targetData *string

	query := `
		SELECT id, title, content, image_url, link_url, link_text, type, priority, is_active, is_dismissable, start_at, end_at, target_type, target_data::text, created_by, created_at, updated_at
		FROM announcements
		WHERE id = $1`

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&announcement.ID,
		&announcement.Title,
		&announcement.Content,
		&announcement.ImageURL,
		&announcement.LinkURL,
		&announcement.LinkText,
		&announcement.Type,
		&announcement.Priority,
		&announcement.IsActive,
		&announcement.IsDismissable,
		&announcement.StartAt,
		&announcement.EndAt,
		&announcement.TargetType,
		&targetData,
		&announcement.CreatedBy,
		&announcement.CreatedAt,
		&announcement.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	announcement.TargetData = targetData
	return &announcement, nil
}

// Update - Duyuru güncelle
func (r *AnnouncementRepository) Update(ctx context.Context, id uuid.UUID, req *models.AnnouncementUpdateRequest) (*models.Announcement, error) {
	// Mevcut duyuruyu al
	announcement, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Güncelle
	if req.Title != nil {
		announcement.Title = *req.Title
	}
	if req.Content != nil {
		announcement.Content = *req.Content
	}
	if req.ImageURL != nil {
		announcement.ImageURL = req.ImageURL
	}
	if req.LinkURL != nil {
		announcement.LinkURL = req.LinkURL
	}
	if req.LinkText != nil {
		announcement.LinkText = req.LinkText
	}
	if req.Type != nil {
		announcement.Type = *req.Type
	}
	if req.Priority != nil {
		announcement.Priority = *req.Priority
	}
	if req.IsActive != nil {
		announcement.IsActive = *req.IsActive
	}
	if req.IsDismissable != nil {
		announcement.IsDismissable = *req.IsDismissable
	}
	if req.StartAt != nil {
		announcement.StartAt = req.StartAt
	}
	if req.EndAt != nil {
		announcement.EndAt = req.EndAt
	}
	if req.TargetType != nil {
		announcement.TargetType = *req.TargetType
	}
	if req.TargetData != nil {
		announcement.TargetData = req.TargetData
	}

	query := `
		UPDATE announcements
		SET title = $2, content = $3, image_url = $4, link_url = $5, link_text = $6, type = $7, priority = $8, is_active = $9, is_dismissable = $10, start_at = $11, end_at = $12, target_type = $13, target_data = $14
		WHERE id = $1
		RETURNING updated_at`

	var targetDataJSON interface{}
	if announcement.TargetData != nil {
		targetDataJSON = *announcement.TargetData
	}

	err = r.db.Pool.QueryRow(ctx, query,
		id,
		announcement.Title,
		announcement.Content,
		announcement.ImageURL,
		announcement.LinkURL,
		announcement.LinkText,
		announcement.Type,
		announcement.Priority,
		announcement.IsActive,
		announcement.IsDismissable,
		announcement.StartAt,
		announcement.EndAt,
		announcement.TargetType,
		targetDataJSON,
	).Scan(&announcement.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return announcement, nil
}

// Delete - Duyuru sil
func (r *AnnouncementRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM announcements WHERE id = $1`, id)
	return err
}

// GetAll - Tüm duyuruları getir (admin için)
func (r *AnnouncementRepository) GetAll(ctx context.Context, limit, offset int, isActive *bool, announcementType string) ([]models.Announcement, int, error) {
	var announcements []models.Announcement
	var total int

	// Build query
	baseQuery := `FROM announcements WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if isActive != nil {
		baseQuery += fmt.Sprintf(` AND is_active = $%d`, argIndex)
		args = append(args, *isActive)
		argIndex++
	}

	if announcementType != "" {
		baseQuery += fmt.Sprintf(` AND type = $%d`, argIndex)
		args = append(args, announcementType)
		argIndex++
	}

	// Count
	countQuery := `SELECT COUNT(*) ` + baseQuery
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get data
	selectQuery := fmt.Sprintf(`
		SELECT id, title, content, image_url, link_url, link_text, type, priority, is_active, is_dismissable, start_at, end_at, target_type, target_data::text, created_by, created_at, updated_at
		%s ORDER BY priority DESC, created_at DESC LIMIT $%d OFFSET $%d`, baseQuery, argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var a models.Announcement
		var targetData *string
		err := rows.Scan(
			&a.ID, &a.Title, &a.Content, &a.ImageURL, &a.LinkURL, &a.LinkText,
			&a.Type, &a.Priority, &a.IsActive, &a.IsDismissable, &a.StartAt, &a.EndAt,
			&a.TargetType, &targetData, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		a.TargetData = targetData
		announcements = append(announcements, a)
	}

	return announcements, total, nil
}

// GetActiveForDriver - Şoför için aktif duyuruları getir
func (r *AnnouncementRepository) GetActiveForDriver(ctx context.Context, driverID uuid.UUID, province string) ([]models.AnnouncementResponse, error) {
	var announcements []models.AnnouncementResponse
	now := time.Now()

	query := `
		SELECT a.id, a.title, a.content, a.image_url, a.link_url, a.link_text, a.type, a.is_dismissable
		FROM announcements a
		LEFT JOIN announcement_dismissals ad ON a.id = ad.announcement_id AND ad.driver_id = $1
		WHERE a.is_active = true
		AND ad.id IS NULL
		AND (a.start_at IS NULL OR a.start_at <= $2)
		AND (a.end_at IS NULL OR a.end_at >= $2)
		AND (
			a.target_type = 'all'
			OR (a.target_type = 'province' AND a.target_data::jsonb ? $3)
			OR (a.target_type = 'specific_drivers' AND a.target_data::jsonb ? $4)
		)
		ORDER BY a.priority DESC, a.created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, driverID, now, province, driverID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var a models.AnnouncementResponse
		err := rows.Scan(
			&a.ID, &a.Title, &a.Content, &a.ImageURL, &a.LinkURL, &a.LinkText, &a.Type, &a.IsDismissable,
		)
		if err != nil {
			return nil, err
		}
		announcements = append(announcements, a)
	}

	return announcements, nil
}

// DismissAnnouncement - Şoför duyuruyu kapatır
func (r *AnnouncementRepository) DismissAnnouncement(ctx context.Context, announcementID, driverID uuid.UUID) error {
	query := `
		INSERT INTO announcement_dismissals (announcement_id, driver_id)
		VALUES ($1, $2)
		ON CONFLICT (announcement_id, driver_id) DO NOTHING`

	_, err := r.db.Pool.Exec(ctx, query, announcementID, driverID)
	return err
}

// GetDismissedByDriver - Şoförün kapattığı duyuru ID'leri
func (r *AnnouncementRepository) GetDismissedByDriver(ctx context.Context, driverID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID

	rows, err := r.db.Pool.Query(ctx, `
		SELECT announcement_id FROM announcement_dismissals WHERE driver_id = $1
	`, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}

	return ids, nil
}

// GetStats - Duyuru istatistikleri
func (r *AnnouncementRepository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Toplam duyuru sayısı
	var total, active int
	err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM announcements`).Scan(&total)
	if err != nil {
		return nil, err
	}
	stats["total"] = total

	err = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM announcements WHERE is_active = true`).Scan(&active)
	if err != nil {
		return nil, err
	}
	stats["active"] = active

	// Tipe göre dağılım
	typeStats := make(map[string]int)
	rows, err := r.db.Pool.Query(ctx, `
		SELECT type, COUNT(*) FROM announcements GROUP BY type
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t string
		var count int
		if err := rows.Scan(&t, &count); err == nil {
			typeStats[t] = count
		}
	}
	stats["by_type"] = typeStats

	// Son 7 gün dismissal sayısı
	var dismissals int
	err = r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM announcement_dismissals WHERE dismissed_at > NOW() - INTERVAL '7 days'
	`).Scan(&dismissals)
	if err != nil {
		return nil, err
	}
	stats["dismissals_last_7_days"] = dismissals

	return stats, nil
}

// GetTargetDriverIDs - Hedef şoför ID'lerini getir (specific_drivers için)
func (r *AnnouncementRepository) GetTargetDriverIDs(ctx context.Context, id uuid.UUID) ([]uuid.UUID, error) {
	announcement, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if announcement.TargetType != "specific_drivers" || announcement.TargetData == nil {
		return nil, nil
	}

	var ids []string
	if err := json.Unmarshal([]byte(*announcement.TargetData), &ids); err != nil {
		return nil, err
	}

	var uuids []uuid.UUID
	for _, idStr := range ids {
		if uid, err := uuid.Parse(idStr); err == nil {
			uuids = append(uuids, uid)
		}
	}

	return uuids, nil
}
