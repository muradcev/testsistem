package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
)

type QuestionFlowTemplateRepository struct {
	db *PostgresDB
}

func NewQuestionFlowTemplateRepository(db *PostgresDB) *QuestionFlowTemplateRepository {
	return &QuestionFlowTemplateRepository{db: db}
}

// Create - Yeni sablon olustur
func (r *QuestionFlowTemplateRepository) Create(ctx context.Context, req *models.QuestionFlowTemplateCreateRequest, createdBy *uuid.UUID) (*models.QuestionFlowTemplate, error) {
	// Nodes ve Edges'i JSON'a donustur
	nodesJSON, err := json.Marshal(req.Nodes)
	if err != nil {
		return nil, fmt.Errorf("nodes JSON marshal error: %w", err)
	}

	edgesJSON, err := json.Marshal(req.Edges)
	if err != nil {
		return nil, fmt.Errorf("edges JSON marshal error: %w", err)
	}

	// Tags'i JSON'a donustur
	tagsJSON, err := json.Marshal(req.Tags)
	if err != nil {
		tagsJSON = []byte("[]")
	}

	isPublic := true
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}

	template := &models.QuestionFlowTemplate{
		Name:        req.Name,
		Description: req.Description,
		FlowNodes:   string(nodesJSON),
		FlowEdges:   string(edgesJSON),
		Category:    req.Category,
		Tags:        req.Tags,
		IsActive:    true,
		IsPublic:    isPublic,
		CreatedBy:   createdBy,
	}

	query := `
		INSERT INTO question_flow_templates (name, description, flow_nodes, flow_edges, category, tags, is_active, is_public, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, usage_count, created_at, updated_at`

	err = r.db.Pool.QueryRow(ctx, query,
		template.Name,
		template.Description,
		template.FlowNodes,
		template.FlowEdges,
		template.Category,
		string(tagsJSON),
		template.IsActive,
		template.IsPublic,
		template.CreatedBy,
	).Scan(&template.ID, &template.UsageCount, &template.CreatedAt, &template.UpdatedAt)

	if err != nil {
		return nil, err
	}

	// Parse flow data for response
	template.Nodes = req.Nodes
	template.Edges = req.Edges

	return template, nil
}

// GetByID - ID ile sablon getir
func (r *QuestionFlowTemplateRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.QuestionFlowTemplate, error) {
	var template models.QuestionFlowTemplate
	var tagsJSON string

	query := `
		SELECT id, name, description, flow_nodes, flow_edges, category, COALESCE(tags::text, '[]'), usage_count, last_used_at, is_active, is_public, created_by, created_at, updated_at
		FROM question_flow_templates
		WHERE id = $1`

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&template.ID,
		&template.Name,
		&template.Description,
		&template.FlowNodes,
		&template.FlowEdges,
		&template.Category,
		&tagsJSON,
		&template.UsageCount,
		&template.LastUsedAt,
		&template.IsActive,
		&template.IsPublic,
		&template.CreatedBy,
		&template.CreatedAt,
		&template.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Parse JSON fields
	if err := template.ParseFlowData(); err != nil {
		return nil, fmt.Errorf("parse flow data error: %w", err)
	}

	// Parse tags
	if tagsJSON != "" {
		json.Unmarshal([]byte(tagsJSON), &template.Tags)
	}

	return &template, nil
}

// Update - Sablon guncelle
func (r *QuestionFlowTemplateRepository) Update(ctx context.Context, id uuid.UUID, req *models.QuestionFlowTemplateUpdateRequest) (*models.QuestionFlowTemplate, error) {
	// Mevcut sablonu al
	template, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Guncelle
	if req.Name != nil {
		template.Name = *req.Name
	}
	if req.Description != nil {
		template.Description = req.Description
	}
	if req.Nodes != nil {
		nodesJSON, err := json.Marshal(req.Nodes)
		if err != nil {
			return nil, fmt.Errorf("nodes JSON marshal error: %w", err)
		}
		template.FlowNodes = string(nodesJSON)
		template.Nodes = req.Nodes
	}
	if req.Edges != nil {
		edgesJSON, err := json.Marshal(req.Edges)
		if err != nil {
			return nil, fmt.Errorf("edges JSON marshal error: %w", err)
		}
		template.FlowEdges = string(edgesJSON)
		template.Edges = req.Edges
	}
	if req.Category != nil {
		template.Category = req.Category
	}
	if req.Tags != nil {
		template.Tags = req.Tags
	}
	if req.IsActive != nil {
		template.IsActive = *req.IsActive
	}
	if req.IsPublic != nil {
		template.IsPublic = *req.IsPublic
	}

	// Tags'i JSON'a donustur
	tagsJSON, err := json.Marshal(template.Tags)
	if err != nil {
		tagsJSON = []byte("[]")
	}

	query := `
		UPDATE question_flow_templates
		SET name = $2, description = $3, flow_nodes = $4, flow_edges = $5, category = $6, tags = $7, is_active = $8, is_public = $9
		WHERE id = $1
		RETURNING updated_at`

	err = r.db.Pool.QueryRow(ctx, query,
		id,
		template.Name,
		template.Description,
		template.FlowNodes,
		template.FlowEdges,
		template.Category,
		string(tagsJSON),
		template.IsActive,
		template.IsPublic,
	).Scan(&template.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return template, nil
}

// Delete - Sablon sil
func (r *QuestionFlowTemplateRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM question_flow_templates WHERE id = $1`, id)
	return err
}

// GetAll - Tum sablonlari getir
func (r *QuestionFlowTemplateRepository) GetAll(ctx context.Context, limit, offset int, category string, isActive *bool) ([]models.QuestionFlowTemplate, int, error) {
	var templates []models.QuestionFlowTemplate
	var total int

	// Build query
	baseQuery := `FROM question_flow_templates WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if category != "" {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argIndex)
		args = append(args, category)
		argIndex++
	}

	if isActive != nil {
		baseQuery += fmt.Sprintf(` AND is_active = $%d`, argIndex)
		args = append(args, *isActive)
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
		SELECT id, name, description, flow_nodes, flow_edges, category, COALESCE(tags::text, '[]'), usage_count, last_used_at, is_active, is_public, created_by, created_at, updated_at
		%s ORDER BY usage_count DESC, created_at DESC LIMIT $%d OFFSET $%d`, baseQuery, argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var t models.QuestionFlowTemplate
		var tagsJSON string
		err := rows.Scan(
			&t.ID, &t.Name, &t.Description, &t.FlowNodes, &t.FlowEdges,
			&t.Category, &tagsJSON, &t.UsageCount, &t.LastUsedAt,
			&t.IsActive, &t.IsPublic, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		// Parse JSON fields
		if err := t.ParseFlowData(); err != nil {
			return nil, 0, err
		}

		// Parse tags
		if tagsJSON != "" {
			json.Unmarshal([]byte(tagsJSON), &t.Tags)
		}

		templates = append(templates, t)
	}

	return templates, total, nil
}

// IncrementUsageCount - Kullanim sayisini artir
func (r *QuestionFlowTemplateRepository) IncrementUsageCount(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE question_flow_templates
		SET usage_count = usage_count + 1, last_used_at = $2
		WHERE id = $1
	`, id, time.Now())
	return err
}

// GetStats - Sablon istatistikleri
func (r *QuestionFlowTemplateRepository) GetStats(ctx context.Context) (*models.QuestionFlowTemplateStats, error) {
	stats := &models.QuestionFlowTemplateStats{}

	// Toplam sablon sayisi
	err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM question_flow_templates`).Scan(&stats.TotalTemplates)
	if err != nil {
		return nil, err
	}

	// Aktif sablon sayisi
	err = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM question_flow_templates WHERE is_active = true`).Scan(&stats.ActiveTemplates)
	if err != nil {
		return nil, err
	}

	// Toplam kullanim
	err = r.db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(usage_count), 0) FROM question_flow_templates`).Scan(&stats.TotalUsageCount)
	if err != nil {
		return nil, err
	}

	// Ortalama node sayisi
	err = r.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(jsonb_array_length(flow_nodes)), 0)
		FROM question_flow_templates
	`).Scan(&stats.AvgNodesPerFlow)
	if err != nil {
		// Ignore error, keep default
		stats.AvgNodesPerFlow = 0
	}

	// En cok kullanilan kategori
	err = r.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(category, 'genel')
		FROM question_flow_templates
		WHERE is_active = true
		GROUP BY category
		ORDER BY COUNT(*) DESC
		LIMIT 1
	`).Scan(&stats.MostUsedCategory)
	if err != nil {
		stats.MostUsedCategory = "genel"
	}

	return stats, nil
}

// GetCategories - Tum kategorileri getir
func (r *QuestionFlowTemplateRepository) GetCategories(ctx context.Context) ([]string, error) {
	var categories []string

	rows, err := r.db.Pool.Query(ctx, `
		SELECT DISTINCT category FROM question_flow_templates WHERE category IS NOT NULL ORDER BY category
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err == nil {
			categories = append(categories, cat)
		}
	}

	return categories, nil
}

// Duplicate - Sablonu kopyala
func (r *QuestionFlowTemplateRepository) Duplicate(ctx context.Context, id uuid.UUID, newName string, createdBy *uuid.UUID) (*models.QuestionFlowTemplate, error) {
	original, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	req := &models.QuestionFlowTemplateCreateRequest{
		Name:        newName,
		Description: original.Description,
		Nodes:       original.Nodes,
		Edges:       original.Edges,
		Category:    original.Category,
		Tags:        original.Tags,
		IsPublic:    &original.IsPublic,
	}

	return r.Create(ctx, req, createdBy)
}
