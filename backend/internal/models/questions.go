package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// DriverQuestion - Kullanıcıya özel akıllı sorular
type DriverQuestion struct {
	ID        uuid.UUID `json:"id" db:"id"`
	DriverID  uuid.UUID `json:"driver_id" db:"driver_id"`

	// Soru içeriği
	QuestionText      string          `json:"question_text" db:"question_text"`
	QuestionType      string          `json:"question_type" db:"question_type"` // yes_no, multiple_choice, text, number, price, route_select
	Options           json.RawMessage `json:"options,omitempty" db:"options"`
	FollowUpQuestions json.RawMessage `json:"follow_up_questions,omitempty" db:"follow_up_questions"`

	// Kaynak ve durum
	SourceType string `json:"source_type" db:"source_type"` // manual, ai_generated, rule_based, template
	Status     string `json:"status" db:"status"`           // draft, pending_approval, approved, sent, answered, expired, rejected

	// Bağlam
	ContextType string          `json:"context_type,omitempty" db:"context_type"`
	ContextData json.RawMessage `json:"context_data,omitempty" db:"context_data"`

	// İlişkili kayıtlar
	RelatedTripID *uuid.UUID `json:"related_trip_id,omitempty" db:"related_trip_id"`
	TemplateID    *uuid.UUID `json:"template_id,omitempty" db:"template_id"`

	// Öncelik ve zamanlama
	Priority     int        `json:"priority" db:"priority"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	ScheduledFor *time.Time `json:"scheduled_for,omitempty" db:"scheduled_for"`

	// Onay bilgileri
	ApprovedBy      *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty" db:"approved_at"`
	RejectionReason *string    `json:"rejection_reason,omitempty" db:"rejection_reason"`

	// AI üretim bilgileri
	AIConfidence *float64 `json:"ai_confidence,omitempty" db:"ai_confidence"`
	AIReasoning  *string  `json:"ai_reasoning,omitempty" db:"ai_reasoning"`

	// Gönderim bilgileri
	SentAt         *time.Time `json:"sent_at,omitempty" db:"sent_at"`
	NotificationID *uuid.UUID `json:"notification_id,omitempty" db:"notification_id"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`

	// Join fields
	DriverName     string `json:"driver_name,omitempty" db:"driver_name"`
	DriverSurname  string `json:"driver_surname,omitempty" db:"driver_surname"`
	DriverPhone    string `json:"driver_phone,omitempty" db:"driver_phone"`
	DriverProvince string `json:"driver_province,omitempty" db:"driver_province"`
	RuleName       string `json:"rule_name,omitempty" db:"rule_name"`
}

// DriverQuestionUpdate - Soru güncelleme için
type DriverQuestionUpdate struct {
	QuestionText      string          `json:"question_text,omitempty"`
	QuestionType      string          `json:"question_type,omitempty"`
	Options           json.RawMessage `json:"options,omitempty"`
	FollowUpQuestions json.RawMessage `json:"follow_up_questions,omitempty"`
	Priority          *int            `json:"priority,omitempty"`
	ExpiresAt         *time.Time      `json:"expires_at,omitempty"`
	ScheduledFor      *time.Time      `json:"scheduled_for,omitempty"`
}

// DriverQuestionAnswer - Soru cevapları
type DriverQuestionAnswer struct {
	ID         uuid.UUID `json:"id" db:"id"`
	QuestionID uuid.UUID `json:"question_id" db:"question_id"`
	DriverID   uuid.UUID `json:"driver_id" db:"driver_id"`

	// Cevap
	AnswerValue       string          `json:"answer_value" db:"answer_value"`
	AnswerType        string          `json:"answer_type" db:"answer_type"` // text, number, boolean, json
	FollowUpAnswers   json.RawMessage `json:"follow_up_answers,omitempty" db:"follow_up_answers"`

	// Meta
	AnsweredAt            time.Time `json:"answered_at" db:"answered_at"`
	AnswerDurationSeconds *int      `json:"answer_duration_seconds,omitempty" db:"answer_duration_seconds"`

	// Konum
	Latitude  *float64 `json:"latitude,omitempty" db:"latitude"`
	Longitude *float64 `json:"longitude,omitempty" db:"longitude"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// QuestionRule - Otomatik soru üretim kuralları
type QuestionRule struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description,omitempty" db:"description"`

	// Tetikleyici koşullar
	TriggerCondition string          `json:"trigger_condition" db:"trigger_condition"` // driver_on_trip, trip_completed, idle_driver, location_change
	ConditionConfig  json.RawMessage `json:"condition_config,omitempty" db:"condition_config"`

	// Soru şablonu
	QuestionTemplate string          `json:"question_template" db:"question_template"`
	QuestionType     string          `json:"question_type" db:"question_type"`
	OptionsTemplate  json.RawMessage `json:"options_template,omitempty" db:"options_template"`
	FollowUpTemplate json.RawMessage `json:"follow_up_template,omitempty" db:"follow_up_template"`

	// Ayarlar
	IsActive               bool    `json:"is_active" db:"is_active"`
	RequiresApproval       bool    `json:"requires_approval" db:"requires_approval"`
	AutoApproveConfidence  float64 `json:"auto_approve_confidence" db:"auto_approve_confidence"`
	Priority               int     `json:"priority" db:"priority"`
	CooldownHours          int     `json:"cooldown_hours" db:"cooldown_hours"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// SurveyTemplate - Anket şablonları
type SurveyTemplate struct {
	ID            uuid.UUID       `json:"id" db:"id"`
	Name          string          `json:"name" db:"name"`
	Description   *string         `json:"description,omitempty" db:"description"`
	TriggerType   *string         `json:"trigger_type,omitempty" db:"trigger_type"`
	TriggerConfig json.RawMessage `json:"trigger_config,omitempty" db:"trigger_config"`
	IsActive      bool            `json:"is_active" db:"is_active"`
	IsRequired    bool            `json:"is_required" db:"is_required"`
	Priority      int             `json:"priority" db:"priority"`
	Icon          *string         `json:"icon,omitempty" db:"icon"`
	Color         *string         `json:"color,omitempty" db:"color"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at" db:"updated_at"`

	// İlişkili sorular
	Questions []SurveyTemplateQuestion `json:"questions,omitempty"`
}

// SurveyTemplateQuestion - Şablon soruları
type SurveyTemplateQuestion struct {
	ID            uuid.UUID       `json:"id" db:"id"`
	TemplateID    uuid.UUID       `json:"template_id" db:"template_id"`
	QuestionText  string          `json:"question_text" db:"question_text"`
	QuestionType  string          `json:"question_type" db:"question_type"`
	Options       json.RawMessage `json:"options,omitempty" db:"options"`
	IsRequired    bool            `json:"is_required" db:"is_required"`
	OrderNum      int             `json:"order_num" db:"order_num"`
	ShowCondition json.RawMessage `json:"show_condition,omitempty" db:"show_condition"`
	Validation    json.RawMessage `json:"validation,omitempty" db:"validation"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
}

// NotificationTemplate - Bildirim şablonları
type NotificationTemplate struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	Name            string          `json:"name" db:"name"`
	Title           string          `json:"title" db:"title"`
	Body            string          `json:"body" db:"body"`
	Category        string          `json:"category" db:"category"` // announcement, alert, reminder, promotion, system
	TriggerType     *string         `json:"trigger_type,omitempty" db:"trigger_type"`
	TriggerConfig   json.RawMessage `json:"trigger_config,omitempty" db:"trigger_config"`
	TargetAudience  string          `json:"target_audience" db:"target_audience"`
	TargetProvinces []string        `json:"target_provinces,omitempty" db:"target_provinces"`
	ScheduledAt     *time.Time      `json:"scheduled_at,omitempty" db:"scheduled_at"`
	RepeatType      *string         `json:"repeat_type,omitempty" db:"repeat_type"`
	RepeatConfig    json.RawMessage `json:"repeat_config,omitempty" db:"repeat_config"`
	IsActive        bool            `json:"is_active" db:"is_active"`
	SentCount       int             `json:"sent_count" db:"sent_count"`
	ReadCount       int             `json:"read_count" db:"read_count"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

// SurveyTriggerType - Anket tetikleyici tipleri
type SurveyTriggerType struct {
	ID          string  `json:"id" db:"id"`
	Name        string  `json:"name" db:"name"`
	Description *string `json:"description,omitempty" db:"description"`
	IsActive    bool    `json:"is_active" db:"is_active"`
}

// QuestionStatusType - Soru durum tipleri
type QuestionStatusType struct {
	ID          string  `json:"id" db:"id"`
	Name        string  `json:"name" db:"name"`
	Description *string `json:"description,omitempty" db:"description"`
}

// QuestionSourceType - Soru kaynak tipleri
type QuestionSourceType struct {
	ID          string  `json:"id" db:"id"`
	Name        string  `json:"name" db:"name"`
	Description *string `json:"description,omitempty" db:"description"`
}

// FollowUpQuestion - Takip sorusu yapısı
type FollowUpQuestion struct {
	Condition map[string]interface{} `json:"condition"`
	Question  string                 `json:"question"`
	Type      string                 `json:"type"`
	Options   []string               `json:"options,omitempty"`
}

// FollowUpAnswer - Takip sorusu cevabı
type FollowUpAnswer struct {
	Question string      `json:"question"`
	Answer   interface{} `json:"answer"`
}

// CreateQuestionRequest - Yeni soru oluşturma isteği
type CreateQuestionRequest struct {
	DriverID          uuid.UUID         `json:"driver_id" binding:"required"`
	QuestionText      string            `json:"question_text" binding:"required"`
	QuestionType      string            `json:"question_type" binding:"required"`
	Options           []string          `json:"options,omitempty"`
	FollowUpQuestions []FollowUpQuestion `json:"follow_up_questions,omitempty"`
	ContextType       string            `json:"context_type,omitempty"`
	ContextData       map[string]interface{} `json:"context_data,omitempty"`
	RelatedTripID     *uuid.UUID        `json:"related_trip_id,omitempty"`
	Priority          int               `json:"priority,omitempty"`
	ExpiresAt         *time.Time        `json:"expires_at,omitempty"`
	ScheduledFor      *time.Time        `json:"scheduled_for,omitempty"`
	SendImmediately   bool              `json:"send_immediately,omitempty"`
}

// AnswerQuestionRequest - Soru cevaplama isteği
type AnswerQuestionRequest struct {
	AnswerValue           string           `json:"answer_value" binding:"required"`
	FollowUpAnswers       []FollowUpAnswer `json:"follow_up_answers,omitempty"`
	AnswerDurationSeconds int              `json:"answer_duration_seconds,omitempty"`
	Latitude              *float64         `json:"latitude,omitempty"`
	Longitude             *float64         `json:"longitude,omitempty"`
}

// ApproveQuestionRequest - Soru onaylama isteği
type ApproveQuestionRequest struct {
	Approved        bool   `json:"approved"`
	RejectionReason string `json:"rejection_reason,omitempty"`
}

// BulkQuestionRequest - Toplu soru gönderme isteği
type BulkQuestionRequest struct {
	DriverIDs         []uuid.UUID            `json:"driver_ids" binding:"required"`
	QuestionText      string                 `json:"question_text" binding:"required"`
	QuestionType      string                 `json:"question_type" binding:"required"`
	Options           []string               `json:"options,omitempty"`
	FollowUpQuestions []FollowUpQuestion     `json:"follow_up_questions,omitempty"`
	ContextType       string                 `json:"context_type,omitempty"`
	ContextData       map[string]interface{} `json:"context_data,omitempty"`
	Priority          int                    `json:"priority,omitempty"`
	ExpiresAt         *time.Time             `json:"expires_at,omitempty"`
	ScheduledFor      *time.Time             `json:"scheduled_for,omitempty"`
	SendImmediately   bool                   `json:"send_immediately,omitempty"`
}

// BulkQuestionResult - Toplu soru gönderme sonucu
type BulkQuestionResult struct {
	TotalCount   int         `json:"total_count"`
	SuccessCount int         `json:"success_count"`
	FailedCount  int         `json:"failed_count"`
	FailedIDs    []uuid.UUID `json:"failed_ids,omitempty"`
	CreatedIDs   []uuid.UUID `json:"created_ids"`
}

// FilteredBulkQuestionRequest - Filtreye göre toplu soru gönderme isteği
type FilteredBulkQuestionRequest struct {
	// Filtre seçenekleri (en az biri gerekli)
	Filter           BulkQuestionFilter     `json:"filter" binding:"required"`
	QuestionText     string                 `json:"question_text" binding:"required"`
	QuestionType     string                 `json:"question_type" binding:"required"`
	Options          []string               `json:"options,omitempty"`
	FollowUpQuestions []FollowUpQuestion    `json:"follow_up_questions,omitempty"`
	ContextType      string                 `json:"context_type,omitempty"`
	ContextData      map[string]interface{} `json:"context_data,omitempty"`
	Priority         int                    `json:"priority,omitempty"`
	ExpiresAt        *time.Time             `json:"expires_at,omitempty"`
	ScheduledFor     *time.Time             `json:"scheduled_for,omitempty"`
	SendImmediately  bool                   `json:"send_immediately,omitempty"`
}

// BulkQuestionFilter - Toplu soru gönderme filtresi
type BulkQuestionFilter struct {
	OnTrip           *bool    `json:"on_trip,omitempty"`           // Seferde mi?
	IdleHoursMin     *int     `json:"idle_hours_min,omitempty"`    // Minimum bekleme saati
	Province         *string  `json:"province,omitempty"`          // İl
	HasVehicle       *bool    `json:"has_vehicle,omitempty"`       // Araç var mı?
	HasTrailer       *bool    `json:"has_trailer,omitempty"`       // Dorse var mı?
	RecentTripHours  *int     `json:"recent_trip_hours,omitempty"` // Son X saat içinde sefer bitirmiş
	AllDrivers       bool     `json:"all_drivers,omitempty"`       // Tüm şoförler
}

// DriverOnTrip - Seferdeki şoför view modeli
type DriverOnTrip struct {
	DriverID            uuid.UUID `json:"driver_id" db:"driver_id"`
	Name                string    `json:"name" db:"name"`
	Surname             string    `json:"surname" db:"surname"`
	Phone               string    `json:"phone" db:"phone"`
	TripID              uuid.UUID `json:"trip_id" db:"trip_id"`
	StartedAt           time.Time `json:"started_at" db:"started_at"`
	StartProvince       *string   `json:"start_province,omitempty" db:"start_province"`
	DistanceKm          *float64  `json:"distance_km,omitempty" db:"distance_km"`
	TripDurationMinutes float64   `json:"trip_duration_minutes" db:"trip_duration_minutes"`
	CurrentLat          *float64  `json:"current_lat,omitempty" db:"current_lat"`
	CurrentLng          *float64  `json:"current_lng,omitempty" db:"current_lng"`
	CurrentSpeed        *float64  `json:"current_speed,omitempty" db:"current_speed"`
}

// DriverTripCompleted - Seferi tamamlamış şoför view modeli
type DriverTripCompleted struct {
	DriverID              uuid.UUID `json:"driver_id" db:"driver_id"`
	Name                  string    `json:"name" db:"name"`
	Surname               string    `json:"surname" db:"surname"`
	TripID                uuid.UUID `json:"trip_id" db:"trip_id"`
	FromProvince          *string   `json:"from_province,omitempty" db:"from_province"`
	ToProvince            *string   `json:"to_province,omitempty" db:"to_province"`
	DistanceKm            *float64  `json:"distance_km,omitempty" db:"distance_km"`
	EndedAt               time.Time `json:"ended_at" db:"ended_at"`
	HoursSinceCompletion  float64   `json:"hours_since_completion" db:"hours_since_completion"`
	HasPriceData          int       `json:"has_price_data" db:"has_price_data"`
}

// IdleDriver - Beklemedeki şoför view modeli
type IdleDriver struct {
	DriverID         uuid.UUID  `json:"driver_id" db:"driver_id"`
	Name             string     `json:"name" db:"name"`
	Surname          string     `json:"surname" db:"surname"`
	HomeProvince     *string    `json:"home_province,omitempty" db:"home_province"`
	LastLat          *float64   `json:"last_lat,omitempty" db:"last_lat"`
	LastLng          *float64   `json:"last_lng,omitempty" db:"last_lng"`
	LastLocationTime *time.Time `json:"last_location_time,omitempty" db:"last_location_time"`
	IdleHours        *float64   `json:"idle_hours,omitempty" db:"idle_hours"`
	LastTripEnded    *time.Time `json:"last_trip_ended,omitempty" db:"last_trip_ended"`
}
