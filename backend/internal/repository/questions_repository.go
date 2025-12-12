package repository

import (
	"context"
	"encoding/json"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
)

type QuestionsRepository struct {
	db *PostgresDB
}

func NewQuestionsRepository(db *PostgresDB) *QuestionsRepository {
	return &QuestionsRepository{db: db}
}

// ============================================
// Driver Questions
// ============================================

func (r *QuestionsRepository) CreateQuestion(ctx context.Context, q *models.DriverQuestion) error {
	query := `
		INSERT INTO driver_questions (
			driver_id, question_text, question_type, options, follow_up_questions,
			source_type, status, context_type, context_data, related_trip_id,
			template_id, priority, expires_at, scheduled_for, ai_confidence, ai_reasoning
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		) RETURNING id, created_at, updated_at`

	return r.db.Pool.QueryRow(ctx, query,
		q.DriverID, q.QuestionText, q.QuestionType, q.Options, q.FollowUpQuestions,
		q.SourceType, q.Status, q.ContextType, q.ContextData, q.RelatedTripID,
		q.TemplateID, q.Priority, q.ExpiresAt, q.ScheduledFor, q.AIConfidence, q.AIReasoning,
	).Scan(&q.ID, &q.CreatedAt, &q.UpdatedAt)
}

func (r *QuestionsRepository) GetQuestionByID(ctx context.Context, id uuid.UUID) (*models.DriverQuestion, error) {
	query := `
		SELECT dq.id, dq.driver_id, dq.question_text, dq.question_type, dq.options, dq.follow_up_questions,
			   dq.source_type, dq.status, dq.context_type, dq.context_data, dq.related_trip_id,
			   dq.template_id, dq.priority, dq.expires_at, dq.scheduled_for, dq.sent_at, dq.notification_id,
			   dq.approved_by, dq.approved_at, dq.rejection_reason, dq.ai_confidence, dq.ai_reasoning,
			   dq.created_at, dq.updated_at,
			   d.name as driver_name, d.surname as driver_surname,
			   d.phone as driver_phone, d.province as driver_province
		FROM driver_questions dq
		JOIN drivers d ON dq.driver_id = d.id
		WHERE dq.id = $1`

	var q models.DriverQuestion
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&q.ID, &q.DriverID, &q.QuestionText, &q.QuestionType, &q.Options, &q.FollowUpQuestions,
		&q.SourceType, &q.Status, &q.ContextType, &q.ContextData, &q.RelatedTripID,
		&q.TemplateID, &q.Priority, &q.ExpiresAt, &q.ScheduledFor, &q.SentAt, &q.NotificationID,
		&q.ApprovedBy, &q.ApprovedAt, &q.RejectionReason, &q.AIConfidence, &q.AIReasoning,
		&q.CreatedAt, &q.UpdatedAt,
		&q.DriverName, &q.DriverSurname, &q.DriverPhone, &q.DriverProvince,
	)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

func (r *QuestionsRepository) UpdateQuestion(ctx context.Context, id uuid.UUID, update *models.DriverQuestionUpdate) error {
	query := `
		UPDATE driver_questions SET
			question_text = COALESCE(NULLIF($2, ''), question_text),
			question_type = COALESCE(NULLIF($3, ''), question_type),
			options = COALESCE($4, options),
			follow_up_questions = COALESCE($5, follow_up_questions),
			priority = COALESCE($6, priority),
			expires_at = COALESCE($7, expires_at),
			scheduled_for = COALESCE($8, scheduled_for),
			updated_at = NOW()
		WHERE id = $1`

	_, err := r.db.Pool.Exec(ctx, query,
		id,
		update.QuestionText,
		update.QuestionType,
		update.Options,
		update.FollowUpQuestions,
		update.Priority,
		update.ExpiresAt,
		update.ScheduledFor,
	)
	return err
}

func (r *QuestionsRepository) DeleteQuestion(ctx context.Context, id uuid.UUID) error {
	// Önce cevapları sil
	_, _ = r.db.Pool.Exec(ctx, `DELETE FROM driver_question_answers WHERE question_id = $1`, id)
	// Sonra soruyu sil
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM driver_questions WHERE id = $1`, id)
	return err
}

func (r *QuestionsRepository) GetDriverQuestions(ctx context.Context, driverID uuid.UUID, status string) ([]models.DriverQuestion, error) {
	var questions []models.DriverQuestion

	baseQuery := `
		SELECT id, driver_id, question_text, question_type, options, follow_up_questions,
			   source_type, status, context_type, context_data, related_trip_id,
			   template_id, priority, expires_at, scheduled_for, sent_at, notification_id,
			   approved_by, approved_at, rejection_reason, ai_confidence, ai_reasoning,
			   created_at, updated_at
		FROM driver_questions
		WHERE driver_id = $1`

	var rows interface{ Close() }
	var err error

	if status != "" {
		query := baseQuery + ` AND status = $2 ORDER BY priority DESC, created_at DESC`
		rows, err = r.db.Pool.Query(ctx, query, driverID, status)
	} else {
		query := baseQuery + ` ORDER BY priority DESC, created_at DESC`
		rows, err = r.db.Pool.Query(ctx, query, driverID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pgxRows := rows.(interface {
		Next() bool
		Scan(dest ...interface{}) error
	})

	for pgxRows.Next() {
		var q models.DriverQuestion
		err := pgxRows.Scan(
			&q.ID, &q.DriverID, &q.QuestionText, &q.QuestionType, &q.Options, &q.FollowUpQuestions,
			&q.SourceType, &q.Status, &q.ContextType, &q.ContextData, &q.RelatedTripID,
			&q.TemplateID, &q.Priority, &q.ExpiresAt, &q.ScheduledFor, &q.SentAt, &q.NotificationID,
			&q.ApprovedBy, &q.ApprovedAt, &q.RejectionReason, &q.AIConfidence, &q.AIReasoning,
			&q.CreatedAt, &q.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}

	return questions, nil
}

func (r *QuestionsRepository) GetPendingQuestions(ctx context.Context, driverID uuid.UUID) ([]models.DriverQuestion, error) {
	var questions []models.DriverQuestion
	query := `
		SELECT id, driver_id, question_text, question_type, options, follow_up_questions,
			   source_type, status, context_type, context_data, related_trip_id,
			   template_id, priority, expires_at, scheduled_for, sent_at, notification_id,
			   approved_by, approved_at, rejection_reason, ai_confidence, ai_reasoning,
			   created_at, updated_at
		FROM driver_questions
		WHERE driver_id = $1
		  AND status IN ('approved', 'sent')
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY priority DESC, created_at ASC`

	rows, err := r.db.Pool.Query(ctx, query, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var q models.DriverQuestion
		err := rows.Scan(
			&q.ID, &q.DriverID, &q.QuestionText, &q.QuestionType, &q.Options, &q.FollowUpQuestions,
			&q.SourceType, &q.Status, &q.ContextType, &q.ContextData, &q.RelatedTripID,
			&q.TemplateID, &q.Priority, &q.ExpiresAt, &q.ScheduledFor, &q.SentAt, &q.NotificationID,
			&q.ApprovedBy, &q.ApprovedAt, &q.RejectionReason, &q.AIConfidence, &q.AIReasoning,
			&q.CreatedAt, &q.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}

	return questions, nil
}

func (r *QuestionsRepository) GetPendingApprovalQuestions(ctx context.Context) ([]models.DriverQuestion, error) {
	var questions []models.DriverQuestion
	query := `
		SELECT dq.id, dq.driver_id, dq.question_text, dq.question_type, dq.options, dq.follow_up_questions,
			   dq.source_type, dq.status, dq.context_type, dq.context_data, dq.related_trip_id,
			   dq.template_id, dq.priority, dq.expires_at, dq.scheduled_for, dq.sent_at, dq.notification_id,
			   dq.approved_by, dq.approved_at, dq.rejection_reason, dq.ai_confidence, dq.ai_reasoning,
			   dq.created_at, dq.updated_at,
			   d.name as driver_name, d.surname as driver_surname,
			   d.phone as driver_phone, d.province as driver_province
		FROM driver_questions dq
		JOIN drivers d ON dq.driver_id = d.id
		WHERE dq.status = 'pending_approval'
		ORDER BY dq.priority DESC, dq.created_at ASC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var q models.DriverQuestion
		err := rows.Scan(
			&q.ID, &q.DriverID, &q.QuestionText, &q.QuestionType, &q.Options, &q.FollowUpQuestions,
			&q.SourceType, &q.Status, &q.ContextType, &q.ContextData, &q.RelatedTripID,
			&q.TemplateID, &q.Priority, &q.ExpiresAt, &q.ScheduledFor, &q.SentAt, &q.NotificationID,
			&q.ApprovedBy, &q.ApprovedAt, &q.RejectionReason, &q.AIConfidence, &q.AIReasoning,
			&q.CreatedAt, &q.UpdatedAt,
			&q.DriverName, &q.DriverSurname, &q.DriverPhone, &q.DriverProvince,
		)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}

	return questions, nil
}

func (r *QuestionsRepository) UpdateQuestionStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE driver_questions SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id, status)
	return err
}

func (r *QuestionsRepository) ApproveQuestion(ctx context.Context, id uuid.UUID, adminID uuid.UUID) error {
	query := `
		UPDATE driver_questions
		SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id, adminID)
	return err
}

func (r *QuestionsRepository) RejectQuestion(ctx context.Context, id uuid.UUID, adminID uuid.UUID, reason string) error {
	query := `
		UPDATE driver_questions
		SET status = 'rejected', approved_by = $2, approved_at = NOW(), rejection_reason = $3, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id, adminID, reason)
	return err
}

func (r *QuestionsRepository) MarkQuestionSent(ctx context.Context, id uuid.UUID, notificationID *uuid.UUID) error {
	query := `
		UPDATE driver_questions
		SET status = 'sent', sent_at = NOW(), notification_id = $2, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id, notificationID)
	return err
}

// ============================================
// Question Answers
// ============================================

func (r *QuestionsRepository) CreateAnswer(ctx context.Context, a *models.DriverQuestionAnswer) error {
	query := `
		INSERT INTO driver_question_answers (
			question_id, driver_id, answer_value, answer_type, follow_up_answers,
			answer_duration_seconds, latitude, longitude
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, answered_at, created_at`

	err := r.db.Pool.QueryRow(ctx, query,
		a.QuestionID, a.DriverID, a.AnswerValue, a.AnswerType, a.FollowUpAnswers,
		a.AnswerDurationSeconds, a.Latitude, a.Longitude,
	).Scan(&a.ID, &a.AnsweredAt, &a.CreatedAt)

	if err != nil {
		return err
	}

	// Mark question as answered
	_, err = r.db.Pool.Exec(ctx, `
		UPDATE driver_questions SET status = 'answered', updated_at = NOW() WHERE id = $1
	`, a.QuestionID)

	return err
}

func (r *QuestionsRepository) GetAnswersByQuestion(ctx context.Context, questionID uuid.UUID) ([]models.DriverQuestionAnswer, error) {
	var answers []models.DriverQuestionAnswer
	query := `
		SELECT id, question_id, driver_id, answer_value, answer_type, follow_up_answers,
			   answer_duration_seconds, latitude, longitude, answered_at, created_at
		FROM driver_question_answers WHERE question_id = $1 ORDER BY answered_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, questionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var a models.DriverQuestionAnswer
		err := rows.Scan(
			&a.ID, &a.QuestionID, &a.DriverID, &a.AnswerValue, &a.AnswerType, &a.FollowUpAnswers,
			&a.AnswerDurationSeconds, &a.Latitude, &a.Longitude, &a.AnsweredAt, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		answers = append(answers, a)
	}

	return answers, nil
}

func (r *QuestionsRepository) GetAnswersByDriver(ctx context.Context, driverID uuid.UUID, limit int) ([]models.DriverQuestionAnswer, error) {
	var answers []models.DriverQuestionAnswer
	query := `
		SELECT id, question_id, driver_id, answer_value, answer_type, follow_up_answers,
			   answer_duration_seconds, latitude, longitude, answered_at, created_at
		FROM driver_question_answers WHERE driver_id = $1 ORDER BY answered_at DESC LIMIT $2`

	rows, err := r.db.Pool.Query(ctx, query, driverID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var a models.DriverQuestionAnswer
		err := rows.Scan(
			&a.ID, &a.QuestionID, &a.DriverID, &a.AnswerValue, &a.AnswerType, &a.FollowUpAnswers,
			&a.AnswerDurationSeconds, &a.Latitude, &a.Longitude, &a.AnsweredAt, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		answers = append(answers, a)
	}

	return answers, nil
}

// ============================================
// Question Rules
// ============================================

func (r *QuestionsRepository) GetActiveRules(ctx context.Context) ([]models.QuestionRule, error) {
	var rules []models.QuestionRule
	query := `
		SELECT id, name, description, trigger_condition, condition_config,
			   question_template, question_type, options_template, follow_up_template,
			   is_active, requires_approval, auto_approve_confidence, priority, cooldown_hours,
			   created_at, updated_at
		FROM question_rules WHERE is_active = true ORDER BY priority DESC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule models.QuestionRule
		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Description, &rule.TriggerCondition, &rule.ConditionConfig,
			&rule.QuestionTemplate, &rule.QuestionType, &rule.OptionsTemplate, &rule.FollowUpTemplate,
			&rule.IsActive, &rule.RequiresApproval, &rule.AutoApproveConfidence, &rule.Priority, &rule.CooldownHours,
			&rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *QuestionsRepository) GetRuleByID(ctx context.Context, id uuid.UUID) (*models.QuestionRule, error) {
	var rule models.QuestionRule
	query := `
		SELECT id, name, description, trigger_condition, condition_config,
			   question_template, question_type, options_template, follow_up_template,
			   is_active, requires_approval, auto_approve_confidence, priority, cooldown_hours,
			   created_at, updated_at
		FROM question_rules WHERE id = $1`

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&rule.ID, &rule.Name, &rule.Description, &rule.TriggerCondition, &rule.ConditionConfig,
		&rule.QuestionTemplate, &rule.QuestionType, &rule.OptionsTemplate, &rule.FollowUpTemplate,
		&rule.IsActive, &rule.RequiresApproval, &rule.AutoApproveConfidence, &rule.Priority, &rule.CooldownHours,
		&rule.CreatedAt, &rule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *QuestionsRepository) CreateRule(ctx context.Context, rule *models.QuestionRule) error {
	query := `
		INSERT INTO question_rules (
			name, description, trigger_condition, condition_config,
			question_template, question_type, options_template, follow_up_template,
			is_active, requires_approval, auto_approve_confidence, priority, cooldown_hours
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`

	return r.db.Pool.QueryRow(ctx, query,
		rule.Name, rule.Description, rule.TriggerCondition, rule.ConditionConfig,
		rule.QuestionTemplate, rule.QuestionType, rule.OptionsTemplate, rule.FollowUpTemplate,
		rule.IsActive, rule.RequiresApproval, rule.AutoApproveConfidence, rule.Priority, rule.CooldownHours,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
}

func (r *QuestionsRepository) UpdateRule(ctx context.Context, rule *models.QuestionRule) error {
	query := `
		UPDATE question_rules SET
			name = $2, description = $3, trigger_condition = $4, condition_config = $5,
			question_template = $6, question_type = $7, options_template = $8, follow_up_template = $9,
			is_active = $10, requires_approval = $11, auto_approve_confidence = $12,
			priority = $13, cooldown_hours = $14, updated_at = NOW()
		WHERE id = $1`

	_, err := r.db.Pool.Exec(ctx, query,
		rule.ID, rule.Name, rule.Description, rule.TriggerCondition, rule.ConditionConfig,
		rule.QuestionTemplate, rule.QuestionType, rule.OptionsTemplate, rule.FollowUpTemplate,
		rule.IsActive, rule.RequiresApproval, rule.AutoApproveConfidence, rule.Priority, rule.CooldownHours,
	)
	return err
}

func (r *QuestionsRepository) DeleteRule(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM question_rules WHERE id = $1`, id)
	return err
}

func (r *QuestionsRepository) GetAllRules(ctx context.Context) ([]models.QuestionRule, error) {
	var rules []models.QuestionRule
	query := `
		SELECT id, name, description, trigger_condition, condition_config,
			   question_template, question_type, options_template, follow_up_template,
			   is_active, requires_approval, auto_approve_confidence, priority, cooldown_hours,
			   created_at, updated_at
		FROM question_rules ORDER BY priority DESC, created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule models.QuestionRule
		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Description, &rule.TriggerCondition, &rule.ConditionConfig,
			&rule.QuestionTemplate, &rule.QuestionType, &rule.OptionsTemplate, &rule.FollowUpTemplate,
			&rule.IsActive, &rule.RequiresApproval, &rule.AutoApproveConfidence, &rule.Priority, &rule.CooldownHours,
			&rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

// ============================================
// Survey Templates
// ============================================

func (r *QuestionsRepository) GetSurveyTemplates(ctx context.Context, activeOnly bool) ([]models.SurveyTemplate, error) {
	var templates []models.SurveyTemplate
	query := `
		SELECT id, name, description, trigger_type, trigger_config, is_active, is_required,
			   priority, icon, color, created_at, updated_at
		FROM survey_templates`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY priority DESC, created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t models.SurveyTemplate
		err := rows.Scan(
			&t.ID, &t.Name, &t.Description, &t.TriggerType, &t.TriggerConfig, &t.IsActive, &t.IsRequired,
			&t.Priority, &t.Icon, &t.Color, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}

	return templates, nil
}

func (r *QuestionsRepository) GetSurveyTemplateByID(ctx context.Context, id uuid.UUID) (*models.SurveyTemplate, error) {
	var template models.SurveyTemplate
	query := `
		SELECT id, name, description, trigger_type, trigger_config, is_active, is_required,
			   priority, icon, color, created_at, updated_at
		FROM survey_templates WHERE id = $1`

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&template.ID, &template.Name, &template.Description, &template.TriggerType, &template.TriggerConfig,
		&template.IsActive, &template.IsRequired, &template.Priority, &template.Icon, &template.Color,
		&template.CreatedAt, &template.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Get questions
	qQuery := `
		SELECT id, template_id, question_text, question_type, options, is_required, order_num,
			   show_condition, validation, created_at
		FROM survey_template_questions WHERE template_id = $1 ORDER BY order_num`

	qRows, err := r.db.Pool.Query(ctx, qQuery, id)
	if err == nil {
		defer qRows.Close()
		for qRows.Next() {
			var q models.SurveyTemplateQuestion
			err := qRows.Scan(
				&q.ID, &q.TemplateID, &q.QuestionText, &q.QuestionType, &q.Options, &q.IsRequired,
				&q.OrderNum, &q.ShowCondition, &q.Validation, &q.CreatedAt,
			)
			if err == nil {
				template.Questions = append(template.Questions, q)
			}
		}
	}

	return &template, nil
}

func (r *QuestionsRepository) CreateSurveyTemplate(ctx context.Context, t *models.SurveyTemplate) error {
	query := `
		INSERT INTO survey_templates (
			name, description, trigger_type, trigger_config, is_active, is_required, priority, icon, color
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`

	return r.db.Pool.QueryRow(ctx, query,
		t.Name, t.Description, t.TriggerType, t.TriggerConfig,
		t.IsActive, t.IsRequired, t.Priority, t.Icon, t.Color,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *QuestionsRepository) UpdateSurveyTemplate(ctx context.Context, t *models.SurveyTemplate) error {
	query := `
		UPDATE survey_templates SET
			name = $2, description = $3, trigger_type = $4, trigger_config = $5,
			is_active = $6, is_required = $7, priority = $8, icon = $9, color = $10, updated_at = NOW()
		WHERE id = $1`

	_, err := r.db.Pool.Exec(ctx, query,
		t.ID, t.Name, t.Description, t.TriggerType, t.TriggerConfig,
		t.IsActive, t.IsRequired, t.Priority, t.Icon, t.Color,
	)
	return err
}

func (r *QuestionsRepository) DeleteSurveyTemplate(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM survey_templates WHERE id = $1`, id)
	return err
}

// ============================================
// Survey Template Questions
// ============================================

func (r *QuestionsRepository) AddTemplateQuestion(ctx context.Context, q *models.SurveyTemplateQuestion) error {
	query := `
		INSERT INTO survey_template_questions (
			template_id, question_text, question_type, options, is_required, order_num, show_condition, validation
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		q.TemplateID, q.QuestionText, q.QuestionType, q.Options,
		q.IsRequired, q.OrderNum, q.ShowCondition, q.Validation,
	).Scan(&q.ID, &q.CreatedAt)
}

func (r *QuestionsRepository) UpdateTemplateQuestion(ctx context.Context, q *models.SurveyTemplateQuestion) error {
	query := `
		UPDATE survey_template_questions SET
			question_text = $2, question_type = $3, options = $4, is_required = $5,
			order_num = $6, show_condition = $7, validation = $8
		WHERE id = $1`

	_, err := r.db.Pool.Exec(ctx, query,
		q.ID, q.QuestionText, q.QuestionType, q.Options,
		q.IsRequired, q.OrderNum, q.ShowCondition, q.Validation,
	)
	return err
}

func (r *QuestionsRepository) DeleteTemplateQuestion(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM survey_template_questions WHERE id = $1`, id)
	return err
}

// ============================================
// Notification Templates
// ============================================

func (r *QuestionsRepository) GetNotificationTemplates(ctx context.Context, activeOnly bool) ([]models.NotificationTemplate, error) {
	var templates []models.NotificationTemplate
	query := `
		SELECT id, name, title, body, category, trigger_type, trigger_config,
			   target_audience, target_provinces, scheduled_at, repeat_type, repeat_config,
			   is_active, created_at, updated_at
		FROM notification_templates`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t models.NotificationTemplate
		err := rows.Scan(
			&t.ID, &t.Name, &t.Title, &t.Body, &t.Category, &t.TriggerType, &t.TriggerConfig,
			&t.TargetAudience, &t.TargetProvinces, &t.ScheduledAt, &t.RepeatType, &t.RepeatConfig,
			&t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}

	return templates, nil
}

func (r *QuestionsRepository) GetNotificationTemplateByID(ctx context.Context, id uuid.UUID) (*models.NotificationTemplate, error) {
	var template models.NotificationTemplate
	query := `
		SELECT id, name, title, body, category, trigger_type, trigger_config,
			   target_audience, target_provinces, scheduled_at, repeat_type, repeat_config,
			   is_active, created_at, updated_at
		FROM notification_templates WHERE id = $1`

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&template.ID, &template.Name, &template.Title, &template.Body, &template.Category,
		&template.TriggerType, &template.TriggerConfig, &template.TargetAudience, &template.TargetProvinces,
		&template.ScheduledAt, &template.RepeatType, &template.RepeatConfig, &template.IsActive,
		&template.CreatedAt, &template.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &template, nil
}

func (r *QuestionsRepository) CreateNotificationTemplate(ctx context.Context, t *models.NotificationTemplate) error {
	query := `
		INSERT INTO notification_templates (
			name, title, body, category, trigger_type, trigger_config,
			target_audience, target_provinces, scheduled_at, repeat_type, repeat_config, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at`

	return r.db.Pool.QueryRow(ctx, query,
		t.Name, t.Title, t.Body, t.Category, t.TriggerType, t.TriggerConfig,
		t.TargetAudience, t.TargetProvinces, t.ScheduledAt, t.RepeatType, t.RepeatConfig, t.IsActive,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *QuestionsRepository) UpdateNotificationTemplate(ctx context.Context, t *models.NotificationTemplate) error {
	query := `
		UPDATE notification_templates SET
			name = $2, title = $3, body = $4, category = $5, trigger_type = $6, trigger_config = $7,
			target_audience = $8, target_provinces = $9, scheduled_at = $10, repeat_type = $11,
			repeat_config = $12, is_active = $13, updated_at = NOW()
		WHERE id = $1`

	_, err := r.db.Pool.Exec(ctx, query,
		t.ID, t.Name, t.Title, t.Body, t.Category, t.TriggerType, t.TriggerConfig,
		t.TargetAudience, t.TargetProvinces, t.ScheduledAt, t.RepeatType, t.RepeatConfig, t.IsActive,
	)
	return err
}

func (r *QuestionsRepository) DeleteNotificationTemplate(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM notification_templates WHERE id = $1`, id)
	return err
}

// ============================================
// Context Views (Akıllı soru sistemi için)
// ============================================

func (r *QuestionsRepository) GetDriversOnTrip(ctx context.Context) ([]models.DriverOnTrip, error) {
	var drivers []models.DriverOnTrip
	query := `
		SELECT driver_id, name, surname, phone, trip_id, started_at, start_province,
		       distance_km, trip_duration_minutes, current_lat, current_lng, current_speed
		FROM drivers_on_trip`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var d models.DriverOnTrip
		err := rows.Scan(
			&d.DriverID, &d.Name, &d.Surname, &d.Phone, &d.TripID, &d.StartedAt, &d.StartProvince,
			&d.DistanceKm, &d.TripDurationMinutes, &d.CurrentLat, &d.CurrentLng, &d.CurrentSpeed,
		)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

func (r *QuestionsRepository) GetDriversWithCompletedTrip(ctx context.Context, maxHoursAgo int) ([]models.DriverTripCompleted, error) {
	var drivers []models.DriverTripCompleted
	query := `
		SELECT driver_id, name, surname, trip_id, from_province, to_province,
		       distance_km, ended_at, hours_since_completion, has_price_data
		FROM drivers_trip_completed WHERE hours_since_completion <= $1`

	rows, err := r.db.Pool.Query(ctx, query, maxHoursAgo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var d models.DriverTripCompleted
		err := rows.Scan(
			&d.DriverID, &d.Name, &d.Surname, &d.TripID, &d.FromProvince, &d.ToProvince,
			&d.DistanceKm, &d.EndedAt, &d.HoursSinceCompletion, &d.HasPriceData,
		)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

func (r *QuestionsRepository) GetIdleDrivers(ctx context.Context, minIdleHours float64) ([]models.IdleDriver, error) {
	var drivers []models.IdleDriver
	query := `
		SELECT driver_id, name, surname, home_province, last_lat, last_lng,
		       last_location_time, idle_hours, last_trip_ended
		FROM idle_drivers WHERE idle_hours >= $1 OR idle_hours IS NULL`

	rows, err := r.db.Pool.Query(ctx, query, minIdleHours)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var d models.IdleDriver
		err := rows.Scan(
			&d.DriverID, &d.Name, &d.Surname, &d.HomeProvince, &d.LastLat, &d.LastLng,
			&d.LastLocationTime, &d.IdleHours, &d.LastTripEnded,
		)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

// ============================================
// Trigger Types
// ============================================

func (r *QuestionsRepository) GetSurveyTriggerTypes(ctx context.Context) ([]models.SurveyTriggerType, error) {
	var types []models.SurveyTriggerType
	query := `SELECT id, name, description, is_active FROM survey_trigger_types WHERE is_active = true ORDER BY id`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t models.SurveyTriggerType
		err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.IsActive)
		if err != nil {
			return nil, err
		}
		types = append(types, t)
	}

	return types, nil
}

func (r *QuestionsRepository) GetQuestionStatusTypes(ctx context.Context) ([]models.QuestionStatusType, error) {
	var types []models.QuestionStatusType
	query := `SELECT id, name, description FROM question_status_types ORDER BY id`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t models.QuestionStatusType
		err := rows.Scan(&t.ID, &t.Name, &t.Description)
		if err != nil {
			return nil, err
		}
		types = append(types, t)
	}

	return types, nil
}

func (r *QuestionsRepository) GetQuestionSourceTypes(ctx context.Context) ([]models.QuestionSourceType, error) {
	var types []models.QuestionSourceType
	query := `SELECT id, name, description FROM question_source_types ORDER BY id`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t models.QuestionSourceType
		err := rows.Scan(&t.ID, &t.Name, &t.Description)
		if err != nil {
			return nil, err
		}
		types = append(types, t)
	}

	return types, nil
}

// ============================================
// Statistics
// ============================================

func (r *QuestionsRepository) GetQuestionStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total questions by status
	statusQuery := `SELECT status, COUNT(*) as count FROM driver_questions GROUP BY status`
	statusRows, err := r.db.Pool.Query(ctx, statusQuery)
	if err == nil {
		defer statusRows.Close()
		statusMap := make(map[string]int)
		for statusRows.Next() {
			var status string
			var count int
			if statusRows.Scan(&status, &count) == nil {
				statusMap[status] = count
			}
		}
		stats["by_status"] = statusMap
	}

	// Questions by source
	sourceQuery := `SELECT source_type, COUNT(*) as count FROM driver_questions GROUP BY source_type`
	sourceRows, err := r.db.Pool.Query(ctx, sourceQuery)
	if err == nil {
		defer sourceRows.Close()
		sourceMap := make(map[string]int)
		for sourceRows.Next() {
			var source string
			var count int
			if sourceRows.Scan(&source, &count) == nil {
				sourceMap[source] = count
			}
		}
		stats["by_source"] = sourceMap
	}

	// Answer rate
	var totalQuestions, answeredQuestions int
	r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM driver_questions WHERE status IN ('sent', 'answered', 'expired')`).Scan(&totalQuestions)
	r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM driver_questions WHERE status = 'answered'`).Scan(&answeredQuestions)
	if totalQuestions > 0 {
		stats["answer_rate"] = float64(answeredQuestions) / float64(totalQuestions) * 100
	}

	// Pending approval count
	var pendingCount int
	r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM driver_questions WHERE status = 'pending_approval'`).Scan(&pendingCount)
	stats["pending_approval"] = pendingCount

	return stats, nil
}

// ============================================
// Question Generation Helper
// ============================================

func (r *QuestionsRepository) CheckRecentQuestion(ctx context.Context, driverID uuid.UUID, ruleID uuid.UUID, cooldownHours int) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM driver_questions
		WHERE driver_id = $1
		  AND context_data->>'rule_id' = $2
		  AND created_at > NOW() - INTERVAL '1 hour' * $3`
	err := r.db.Pool.QueryRow(ctx, query, driverID, ruleID.String(), cooldownHours).Scan(&count)
	return count > 0, err
}

func (r *QuestionsRepository) LogQuestionGeneration(ctx context.Context, ruleID, driverID, questionID *uuid.UUID, genType, triggerEvent string, wasApproved *bool) error {
	query := `
		INSERT INTO question_generation_log (rule_id, driver_id, question_id, generation_type, trigger_event, was_approved)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Pool.Exec(ctx, query, ruleID, driverID, questionID, genType, triggerEvent, wasApproved)
	return err
}

// ============================================
// Driver Filtering for Bulk Questions
// ============================================

// ActiveDriverBasic - Aktif şoför temel bilgisi
type ActiveDriverBasic struct {
	DriverID uuid.UUID `json:"driver_id" db:"driver_id"`
	Name     string    `json:"name" db:"name"`
	Surname  string    `json:"surname" db:"surname"`
	Province *string   `json:"province,omitempty" db:"province"`
}

func (r *QuestionsRepository) GetAllActiveDrivers(ctx context.Context) ([]ActiveDriverBasic, error) {
	var drivers []ActiveDriverBasic
	query := `
		SELECT id as driver_id, name, surname, province
		FROM drivers
		WHERE is_active = true
		ORDER BY name, surname`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var d ActiveDriverBasic
		err := rows.Scan(&d.DriverID, &d.Name, &d.Surname, &d.Province)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

func (r *QuestionsRepository) GetDriversByProvince(ctx context.Context, province string) ([]ActiveDriverBasic, error) {
	var drivers []ActiveDriverBasic
	query := `
		SELECT id as driver_id, name, surname, province
		FROM drivers
		WHERE is_active = true AND province = $1
		ORDER BY name, surname`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var d ActiveDriverBasic
		err := rows.Scan(&d.DriverID, &d.Name, &d.Surname, &d.Province)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}

// Utility: Convert options slice to JSON
func OptionsToJSON(options []string) json.RawMessage {
	if len(options) == 0 {
		return nil
	}
	data, _ := json.Marshal(options)
	return data
}

// Utility: Convert follow-up questions to JSON
func FollowUpsToJSON(followUps []models.FollowUpQuestion) json.RawMessage {
	if len(followUps) == 0 {
		return nil
	}
	data, _ := json.Marshal(followUps)
	return data
}

// ============================================
// Notification Scheduler Methods
// ============================================

// GetActiveNotificationTemplates - Aktif bildirim şablonlarını getirir
func (r *QuestionsRepository) GetActiveNotificationTemplates(ctx context.Context) ([]models.NotificationTemplate, error) {
	return r.GetNotificationTemplates(ctx, true)
}

// IncrementNotificationSentCount - Bildirim gönderim sayısını artırır
func (r *QuestionsRepository) IncrementNotificationSentCount(ctx context.Context, templateID uuid.UUID, count int) error {
	query := `
		UPDATE notification_templates
		SET sent_count = sent_count + $2, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, templateID, count)
	return err
}

// GetNewDrivers - Son X gün içinde kayıt olan şoförleri getirir
func (r *QuestionsRepository) GetNewDrivers(ctx context.Context, daysAgo int) ([]models.Driver, error) {
	var drivers []models.Driver
	query := `
		SELECT id, phone, name, surname, province, district, fcm_token,
		       is_active, created_at, updated_at
		FROM drivers
		WHERE created_at > NOW() - INTERVAL '1 day' * $1
		  AND is_active = true
		  AND fcm_token IS NOT NULL
		ORDER BY created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, daysAgo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var d models.Driver
		err := rows.Scan(
			&d.ID, &d.Phone, &d.Name, &d.Surname, &d.Province, &d.District, &d.FCMToken,
			&d.IsActive, &d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}

	return drivers, nil
}
