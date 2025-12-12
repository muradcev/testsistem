package repository

import (
	"context"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SurveyRepository struct {
	db *PostgresDB
}

func NewSurveyRepository(db *PostgresDB) *SurveyRepository {
	return &SurveyRepository{db: db}
}

func (r *SurveyRepository) Create(ctx context.Context, survey *models.Survey) error {
	survey.ID = uuid.New()
	survey.CreatedAt = time.Now()
	survey.UpdatedAt = time.Now()

	query := `
		INSERT INTO surveys (id, title, description, trigger_type, trigger_config, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		survey.ID, survey.Title, survey.Description, survey.TriggerType,
		survey.TriggerConfig, survey.IsActive, survey.CreatedAt, survey.UpdatedAt,
	)

	return err
}

func (r *SurveyRepository) CreateQuestion(ctx context.Context, question *models.SurveyQuestion) error {
	question.ID = uuid.New()
	question.CreatedAt = time.Now()

	query := `
		INSERT INTO survey_questions (id, survey_id, question_text, question_type, options, is_required, order_num, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		question.ID, question.SurveyID, question.QuestionText, question.QuestionType,
		question.Options, question.IsRequired, question.Order, question.CreatedAt,
	)

	return err
}

func (r *SurveyRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Survey, error) {
	query := `
		SELECT id, title, description, trigger_type, trigger_config, is_active, created_at, updated_at
		FROM surveys WHERE id = $1
	`

	var survey models.Survey
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&survey.ID, &survey.Title, &survey.Description, &survey.TriggerType,
		&survey.TriggerConfig, &survey.IsActive, &survey.CreatedAt, &survey.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &survey, nil
}

func (r *SurveyRepository) GetWithQuestions(ctx context.Context, id uuid.UUID) (*models.SurveyWithQuestions, error) {
	survey, err := r.GetByID(ctx, id)
	if err != nil || survey == nil {
		return nil, err
	}

	questions, err := r.GetQuestionsBySurvey(ctx, id)
	if err != nil {
		return nil, err
	}

	return &models.SurveyWithQuestions{
		Survey:    *survey,
		Questions: questions,
	}, nil
}

func (r *SurveyRepository) GetQuestionsBySurvey(ctx context.Context, surveyID uuid.UUID) ([]models.SurveyQuestion, error) {
	query := `
		SELECT id, survey_id, question_text, question_type, options, is_required, order_num, created_at
		FROM survey_questions WHERE survey_id = $1
		ORDER BY order_num
	`

	rows, err := r.db.Pool.Query(ctx, query, surveyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.SurveyQuestion
	for rows.Next() {
		var q models.SurveyQuestion
		err := rows.Scan(
			&q.ID, &q.SurveyID, &q.QuestionText, &q.QuestionType,
			&q.Options, &q.IsRequired, &q.Order, &q.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}

	return questions, nil
}

func (r *SurveyRepository) GetAll(ctx context.Context, limit, offset int) ([]models.Survey, int, error) {
	countQuery := `SELECT COUNT(*) FROM surveys`
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, title, description, trigger_type, trigger_config, is_active, created_at, updated_at
		FROM surveys ORDER BY created_at DESC LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var surveys []models.Survey
	for rows.Next() {
		var s models.Survey
		err := rows.Scan(
			&s.ID, &s.Title, &s.Description, &s.TriggerType,
			&s.TriggerConfig, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		surveys = append(surveys, s)
	}

	return surveys, total, nil
}

func (r *SurveyRepository) GetActive(ctx context.Context) ([]models.Survey, error) {
	query := `
		SELECT id, title, description, trigger_type, trigger_config, is_active, created_at, updated_at
		FROM surveys WHERE is_active = true ORDER BY created_at DESC
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var surveys []models.Survey
	for rows.Next() {
		var s models.Survey
		err := rows.Scan(
			&s.ID, &s.Title, &s.Description, &s.TriggerType,
			&s.TriggerConfig, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		surveys = append(surveys, s)
	}

	return surveys, nil
}

func (r *SurveyRepository) Update(ctx context.Context, survey *models.Survey) error {
	survey.UpdatedAt = time.Now()

	query := `
		UPDATE surveys SET
			title = $2, description = $3, trigger_type = $4,
			trigger_config = $5, is_active = $6, updated_at = $7
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		survey.ID, survey.Title, survey.Description, survey.TriggerType,
		survey.TriggerConfig, survey.IsActive, survey.UpdatedAt,
	)

	return err
}

func (r *SurveyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Önce soruları sil
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM survey_questions WHERE survey_id = $1`, id)
	if err != nil {
		return err
	}

	// Sonra anketi sil
	_, err = r.db.Pool.Exec(ctx, `DELETE FROM surveys WHERE id = $1`, id)
	return err
}

func (r *SurveyRepository) SaveResponse(ctx context.Context, response *models.SurveyResponse) error {
	response.ID = uuid.New()
	response.AnsweredAt = time.Now()

	query := `
		INSERT INTO survey_responses (id, driver_id, survey_id, question_id, answer, latitude, longitude, answered_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		response.ID, response.DriverID, response.SurveyID, response.QuestionID,
		response.Answer, response.Latitude, response.Longitude, response.AnsweredAt,
	)

	return err
}

func (r *SurveyRepository) GetResponses(ctx context.Context, surveyID uuid.UUID, limit, offset int) ([]models.SurveyResponseWithDetails, error) {
	query := `
		SELECT sr.id, sr.driver_id, sr.survey_id, sr.question_id, sr.answer,
			sr.latitude, sr.longitude, sr.answered_at,
			d.name || ' ' || d.surname as driver_name,
			sq.question_text, s.title as survey_title
		FROM survey_responses sr
		JOIN drivers d ON sr.driver_id = d.id
		JOIN survey_questions sq ON sr.question_id = sq.id
		JOIN surveys s ON sr.survey_id = s.id
		WHERE sr.survey_id = $1
		ORDER BY sr.answered_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Pool.Query(ctx, query, surveyID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var responses []models.SurveyResponseWithDetails
	for rows.Next() {
		var r models.SurveyResponseWithDetails
		err := rows.Scan(
			&r.ID, &r.DriverID, &r.SurveyID, &r.QuestionID, &r.Answer,
			&r.Latitude, &r.Longitude, &r.AnsweredAt,
			&r.DriverName, &r.QuestionText, &r.SurveyTitle,
		)
		if err != nil {
			return nil, err
		}
		responses = append(responses, r)
	}

	return responses, nil
}

func (r *SurveyRepository) GetPendingSurveysForDriver(ctx context.Context, driverID uuid.UUID) ([]models.SurveyWithQuestions, error) {
	// Manuel tetikleyicili aktif anketleri getir
	query := `
		SELECT s.id, s.title, s.description, s.trigger_type, s.trigger_config, s.is_active, s.created_at, s.updated_at
		FROM surveys s
		WHERE s.is_active = true AND s.trigger_type = 'manual'
		AND NOT EXISTS (
			SELECT 1 FROM survey_responses sr
			WHERE sr.survey_id = s.id AND sr.driver_id = $1
			AND sr.answered_at > NOW() - INTERVAL '24 hours'
		)
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var surveys []models.SurveyWithQuestions
	for rows.Next() {
		var s models.Survey
		err := rows.Scan(
			&s.ID, &s.Title, &s.Description, &s.TriggerType,
			&s.TriggerConfig, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		questions, err := r.GetQuestionsBySurvey(ctx, s.ID)
		if err != nil {
			return nil, err
		}

		surveys = append(surveys, models.SurveyWithQuestions{
			Survey:    s,
			Questions: questions,
		})
	}

	return surveys, nil
}

func (r *SurveyRepository) GetResponseRate(ctx context.Context) (float64, error) {
	query := `
		SELECT
			CASE
				WHEN total_sent = 0 THEN 0
				ELSE (total_responded::float / total_sent::float) * 100
			END as response_rate
		FROM (
			SELECT
				COUNT(DISTINCT sr.driver_id) as total_responded,
				(SELECT COUNT(*) FROM drivers WHERE is_active = true) as total_sent
			FROM survey_responses sr
			WHERE sr.answered_at > NOW() - INTERVAL '7 days'
		) stats
	`

	var rate float64
	err := r.db.Pool.QueryRow(ctx, query).Scan(&rate)
	return rate, err
}
