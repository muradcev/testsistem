package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type TriggerType string

const (
	TriggerTypeManual    TriggerType = "manual"
	TriggerTypeLocation  TriggerType = "location"
	TriggerTypeTime      TriggerType = "time"
	TriggerTypeTripEnd   TriggerType = "trip_end"
	TriggerTypeStopStart TriggerType = "stop_start"
)

type QuestionType string

const (
	QuestionTypeYesNo          QuestionType = "yes_no"
	QuestionTypeMultipleChoice QuestionType = "multiple_choice"
	QuestionTypeNumber         QuestionType = "number"
	QuestionTypeText           QuestionType = "text"
)

type Survey struct {
	ID            uuid.UUID       `json:"id" db:"id"`
	Title         string          `json:"title" db:"title"`
	Description   *string         `json:"description,omitempty" db:"description"`
	TriggerType   TriggerType     `json:"trigger_type" db:"trigger_type"`
	TriggerConfig json.RawMessage `json:"trigger_config" db:"trigger_config"`
	IsActive      bool            `json:"is_active" db:"is_active"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at" db:"updated_at"`
}

type SurveyWithQuestions struct {
	Survey
	Questions []SurveyQuestion `json:"questions"`
}

type SurveyQuestion struct {
	ID           uuid.UUID       `json:"id" db:"id"`
	SurveyID     uuid.UUID       `json:"survey_id" db:"survey_id"`
	QuestionText string          `json:"question_text" db:"question_text"`
	QuestionType QuestionType    `json:"question_type" db:"question_type"`
	Options      json.RawMessage `json:"options,omitempty" db:"options"`
	IsRequired   bool            `json:"is_required" db:"is_required"`
	Order        int             `json:"order" db:"order_num"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
}

type SurveyResponse struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	DriverID   uuid.UUID  `json:"driver_id" db:"driver_id"`
	SurveyID   uuid.UUID  `json:"survey_id" db:"survey_id"`
	QuestionID uuid.UUID  `json:"question_id" db:"question_id"`
	Answer     string     `json:"answer" db:"answer"`
	Latitude   *float64   `json:"latitude,omitempty" db:"latitude"`
	Longitude  *float64   `json:"longitude,omitempty" db:"longitude"`
	AnsweredAt time.Time  `json:"answered_at" db:"answered_at"`
}

type SurveyResponseWithDetails struct {
	SurveyResponse
	DriverName   string `json:"driver_name"`
	QuestionText string `json:"question_text"`
	SurveyTitle  string `json:"survey_title"`
}

// Request/Response DTOs
type SurveyCreateRequest struct {
	Title         string          `json:"title" binding:"required"`
	Description   *string         `json:"description,omitempty"`
	TriggerType   TriggerType     `json:"trigger_type" binding:"required"`
	TriggerConfig json.RawMessage `json:"trigger_config"`
	Questions     []QuestionCreateRequest `json:"questions" binding:"required,min=1"`
}

type QuestionCreateRequest struct {
	QuestionText string          `json:"question_text" binding:"required"`
	QuestionType QuestionType    `json:"question_type" binding:"required"`
	Options      json.RawMessage `json:"options,omitempty"`
	IsRequired   bool            `json:"is_required"`
	Order        int             `json:"order"`
}

type SurveySubmitRequest struct {
	Responses []ResponseSubmit `json:"responses" binding:"required"`
	Latitude  *float64         `json:"latitude,omitempty"`
	Longitude *float64         `json:"longitude,omitempty"`
}

type ResponseSubmit struct {
	QuestionID uuid.UUID `json:"question_id" binding:"required"`
	Answer     string    `json:"answer" binding:"required"`
}

// Trigger config yapıları
type LocationTriggerConfig struct {
	Province string `json:"province,omitempty"`
	District string `json:"district,omitempty"`
	Radius   int    `json:"radius,omitempty"` // metre cinsinden
}

type TimeTriggerConfig struct {
	Hour     int      `json:"hour"`
	Minute   int      `json:"minute"`
	Days     []string `json:"days"` // ["monday", "tuesday", ...]
}

type TripEndTriggerConfig struct {
	MinDistanceKm int `json:"min_distance_km,omitempty"`
	MinDurationMin int `json:"min_duration_min,omitempty"`
}

type StopStartTriggerConfig struct {
	LocationTypes []LocationType `json:"location_types,omitempty"`
	MinDurationMin int           `json:"min_duration_min,omitempty"`
}
