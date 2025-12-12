package service

import (
	"context"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

type SurveyService struct {
	repo *repository.SurveyRepository
}

func NewSurveyService(repo *repository.SurveyRepository) *SurveyService {
	return &SurveyService{repo: repo}
}

func (s *SurveyService) Create(ctx context.Context, req *models.SurveyCreateRequest) (*models.Survey, error) {
	survey := &models.Survey{
		Title:         req.Title,
		Description:   req.Description,
		TriggerType:   req.TriggerType,
		TriggerConfig: req.TriggerConfig,
		IsActive:      true,
	}

	if err := s.repo.Create(ctx, survey); err != nil {
		return nil, err
	}

	// Soruları oluştur
	for i, q := range req.Questions {
		question := &models.SurveyQuestion{
			SurveyID:     survey.ID,
			QuestionText: q.QuestionText,
			QuestionType: q.QuestionType,
			Options:      q.Options,
			IsRequired:   q.IsRequired,
			Order:        i + 1,
		}
		if err := s.repo.CreateQuestion(ctx, question); err != nil {
			return nil, err
		}
	}

	return survey, nil
}

func (s *SurveyService) GetByID(ctx context.Context, id uuid.UUID) (*models.Survey, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *SurveyService) GetWithQuestions(ctx context.Context, id uuid.UUID) (*models.SurveyWithQuestions, error) {
	return s.repo.GetWithQuestions(ctx, id)
}

func (s *SurveyService) GetAll(ctx context.Context, limit, offset int) ([]models.Survey, int, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetAll(ctx, limit, offset)
}

func (s *SurveyService) GetActive(ctx context.Context) ([]models.Survey, error) {
	return s.repo.GetActive(ctx)
}

func (s *SurveyService) Update(ctx context.Context, survey *models.Survey) error {
	return s.repo.Update(ctx, survey)
}

func (s *SurveyService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *SurveyService) GetPendingSurveys(ctx context.Context, driverID uuid.UUID) ([]models.SurveyWithQuestions, error) {
	return s.repo.GetPendingSurveysForDriver(ctx, driverID)
}

func (s *SurveyService) SubmitResponse(ctx context.Context, driverID uuid.UUID, surveyID uuid.UUID, req *models.SurveySubmitRequest) error {
	for _, resp := range req.Responses {
		response := &models.SurveyResponse{
			DriverID:   driverID,
			SurveyID:   surveyID,
			QuestionID: resp.QuestionID,
			Answer:     resp.Answer,
			Latitude:   req.Latitude,
			Longitude:  req.Longitude,
		}

		if err := s.repo.SaveResponse(ctx, response); err != nil {
			return err
		}
	}

	return nil
}

func (s *SurveyService) GetResponses(ctx context.Context, surveyID uuid.UUID, limit, offset int) ([]models.SurveyResponseWithDetails, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.GetResponses(ctx, surveyID, limit, offset)
}

func (s *SurveyService) GetResponseRate(ctx context.Context) (float64, error) {
	return s.repo.GetResponseRate(ctx)
}
