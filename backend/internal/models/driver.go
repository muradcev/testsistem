package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Driver struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	Phone           string     `json:"phone" db:"phone"`
	Name            string     `json:"name" db:"name"`
	Surname         string     `json:"surname" db:"surname"`
	PasswordHash    string     `json:"-" db:"password_hash"`
	Province        string     `json:"province" db:"province"`
	District        string     `json:"district" db:"district"`
	Neighborhood    string     `json:"neighborhood" db:"neighborhood"`
	HomeLatitude    *float64   `json:"home_latitude,omitempty" db:"home_latitude"`
	HomeLongitude   *float64   `json:"home_longitude,omitempty" db:"home_longitude"`
	FCMToken        *string    `json:"-" db:"fcm_token"`
	IsActive        bool       `json:"is_active" db:"is_active"`
	IsPhoneVerified bool       `json:"is_phone_verified" db:"is_phone_verified"`
	LastLocationAt  *time.Time `json:"last_location_at,omitempty" db:"last_location_at"`
	LastLatitude    *float64   `json:"last_latitude,omitempty" db:"last_latitude"`
	LastLongitude   *float64   `json:"last_longitude,omitempty" db:"last_longitude"`
	CurrentStatus   string     `json:"current_status" db:"current_status"` // home, driving, stopped, unknown

	// Uygulama takip bilgileri
	AppVersion                *string    `json:"app_version,omitempty" db:"app_version"`
	AppBuildNumber            *int       `json:"app_build_number,omitempty" db:"app_build_number"`
	DeviceModel               *string    `json:"device_model,omitempty" db:"device_model"`
	DeviceOS                  *string    `json:"device_os,omitempty" db:"device_os"`
	DeviceOSVersion           *string    `json:"device_os_version,omitempty" db:"device_os_version"`
	LastActiveAt              *time.Time `json:"last_active_at,omitempty" db:"last_active_at"`
	AppInstalledAt            *time.Time `json:"app_installed_at,omitempty" db:"app_installed_at"`
	PushEnabled               bool       `json:"push_enabled" db:"push_enabled"`
	LocationPermission        string     `json:"location_permission" db:"location_permission"`
	BackgroundLocationEnabled bool       `json:"background_location_enabled" db:"background_location_enabled"`

	// İzin durumları (mobil cihazdan gelen)
	ContactsPermission     *string `json:"contacts_permission,omitempty" db:"contacts_permission"`
	PhonePermission        *string `json:"phone_permission,omitempty" db:"phone_permission"`
	CallLogPermission      *string `json:"call_log_permission,omitempty" db:"call_log_permission"` // Android 9+ için READ_CALL_LOG izni
	NotificationPermission *string `json:"notification_permission,omitempty" db:"notification_permission"`

	// Pil optimizasyonu durumu (Android)
	BatteryOptimizationDisabled bool `json:"battery_optimization_disabled" db:"battery_optimization_disabled"`

	// Özellik flag'leri (admin tarafından kontrol edilir)
	ContactsEnabled  bool `json:"contacts_enabled" db:"contacts_enabled"`
	CallLogEnabled   bool `json:"call_log_enabled" db:"call_log_enabled"`
	SurveysEnabled   bool `json:"surveys_enabled" db:"surveys_enabled"`
	QuestionsEnabled bool `json:"questions_enabled" db:"questions_enabled"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type DriverRegisterRequest struct {
	Phone        string `json:"phone" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Surname      string `json:"surname" binding:"required"`
	Password     string `json:"password" binding:"required,min=6"`
	Province     string `json:"province" binding:"required"`
	District     string `json:"district" binding:"required"`
	Neighborhood string `json:"neighborhood"` // Optional - removed from app
}

type DriverLoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type DriverUpdateRequest struct {
	Name          string   `json:"name,omitempty"`
	Surname       string   `json:"surname,omitempty"`
	Province      string   `json:"province,omitempty"`
	District      string   `json:"district,omitempty"`
	Neighborhood  string   `json:"neighborhood,omitempty"`
	HomeLatitude  *float64 `json:"home_latitude,omitempty"`
	HomeLongitude *float64 `json:"home_longitude,omitempty"`
}

type DriverListItem struct {
	ID             uuid.UUID  `json:"id"`
	Phone          string     `json:"phone"`
	Name           string     `json:"name"`
	Surname        string     `json:"surname"`
	Province       string     `json:"province"`
	District       string     `json:"district"`
	IsActive       bool       `json:"is_active"`
	Status         string     `json:"status"`         // Mapped status: active, on_trip, at_home, passive
	CurrentStatus  string     `json:"current_status"` // Raw status: home, driving, stopped, unknown
	LastLatitude   *float64   `json:"last_latitude,omitempty"`
	LastLongitude  *float64   `json:"last_longitude,omitempty"`
	LastLocationAt *time.Time `json:"last_location_at,omitempty"`
	VehicleCount   int        `json:"vehicle_count"`
	CreatedAt      time.Time  `json:"created_at"`

	// Uygulama bilgileri
	AppVersion     *string    `json:"app_version,omitempty"`
	DeviceOS       *string    `json:"device_os,omitempty"`
	LastActiveAt   *time.Time `json:"last_active_at,omitempty"`
	AppInstalledAt *time.Time `json:"app_installed_at,omitempty"`
	HasApp         bool       `json:"has_app"`    // app_version != null ise true
	AppStatus      string     `json:"app_status"` // active, inactive, stale, never_installed

	// Bildirim bilgileri
	PushEnabled bool `json:"push_enabled"`
	HasFCMToken bool `json:"has_fcm_token"` // FCM token kayıtlı mı

	// İzin bilgileri
	LocationPermission           string `json:"location_permission"`
	BackgroundLocationEnabled    bool   `json:"background_location_enabled"`
	NotificationPermission       string `json:"notification_permission"`
	ContactsPermission           string `json:"contacts_permission"`
	PhonePermission              string `json:"phone_permission"`
	CallLogPermission            string `json:"call_log_permission"`
	BatteryOptimizationDisabled  bool   `json:"battery_optimization_disabled"`
}

// GetAppStatus - LastActiveAt'e göre uygulama durumunu belirler
// active: Son 1 saat içinde aktif
// inactive: 1-24 saat arası aktif değil
// stale: 24+ saat aktif değil (muhtemelen uygulama silinmiş)
// never_installed: Hiç uygulama bilgisi yok
func GetAppStatus(lastActiveAt *time.Time, hasApp bool) string {
	if !hasApp {
		return "never_installed"
	}
	if lastActiveAt == nil {
		return "stale"
	}

	hoursSinceActive := time.Since(*lastActiveAt).Hours()
	if hoursSinceActive < 1 {
		return "active"
	} else if hoursSinceActive < 24 {
		return "inactive"
	}
	return "stale"
}

// DeviceInfoRequest - Mobil uygulamadan gelen cihaz bilgisi
type DeviceInfoRequest struct {
	AppVersion                string `json:"app_version" binding:"required"`
	AppBuildNumber            int    `json:"app_build_number"`
	DeviceModel               string `json:"device_model" binding:"required"`
	DeviceOS                  string `json:"device_os" binding:"required"` // ios veya android
	DeviceOSVersion           string `json:"device_os_version"`
	PushEnabled               bool   `json:"push_enabled"`
	LocationPermission        string `json:"location_permission"`        // granted, denied, permanently_denied, restricted, limited
	BackgroundLocationEnabled bool   `json:"background_location_enabled"`
	FCMToken                  string `json:"fcm_token,omitempty"`
	// Yeni izin alanları
	ContactsPermission          string `json:"contacts_permission,omitempty"`           // granted, denied, permanently_denied
	PhonePermission             string `json:"phone_permission,omitempty"`              // granted, denied, permanently_denied (CALL_PHONE izni)
	CallLogPermission           string `json:"call_log_permission,omitempty"`           // granted, denied, permanently_denied (Android 9+ READ_CALL_LOG izni)
	NotificationPermission      string `json:"notification_permission,omitempty"`       // granted, denied
	BatteryOptimizationDisabled bool   `json:"battery_optimization_disabled,omitempty"` // Android pil optimizasyonu devre dışı mı
}

// DriverAppStats - Admin panel için uygulama istatistikleri
type DriverAppStats struct {
	TotalDrivers                    int `json:"total_drivers"`
	DriversWithApp                  int `json:"drivers_with_app"`
	IOSCount                        int `json:"ios_count"`
	AndroidCount                    int `json:"android_count"`
	ActiveLast24h                   int `json:"active_last_24h"`
	ActiveLast7d                    int `json:"active_last_7d"`
	NeverActive                     int `json:"never_active"`
	PushEnabledCount                int `json:"push_enabled_count"`
	BackgroundLocCount              int `json:"background_loc_count"`
	BatteryOptimizationDisabledCount int `json:"battery_optimization_disabled_count"` // Pil optimizasyonu devre dışı olanlar
}

// DriverDetailResponse - Admin panel için şoför detay yanıtı (araç ve dorse dahil)
type DriverDetailResponse struct {
	ID              uuid.UUID  `json:"id"`
	Phone           string     `json:"phone"`
	Name            string     `json:"name"`
	Surname         string     `json:"surname"`
	Email           string     `json:"email"` // Boş string olabilir
	Province        string     `json:"province"`
	District        string     `json:"district"`
	Neighborhood    string     `json:"neighborhood,omitempty"`
	HomeLatitude    *float64   `json:"home_latitude,omitempty"`
	HomeLongitude   *float64   `json:"home_longitude,omitempty"`
	IsActive        bool       `json:"is_active"`
	IsPhoneVerified bool       `json:"is_phone_verified"`
	Status          string     `json:"status"` // Mapped status: active, on_trip, at_home, passive
	CurrentStatus   string     `json:"current_status"`
	LastLocationAt  *time.Time `json:"last_location_at,omitempty"`
	LastLatitude    *float64   `json:"last_latitude,omitempty"`
	LastLongitude   *float64   `json:"last_longitude,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	// Türkiye saati formatında zaman alanları (display için)
	LastLocationAtTR string `json:"last_location_at_tr,omitempty"`
	LastActiveAtTR   string `json:"last_active_at_tr,omitempty"`
	CreatedAtTR      string `json:"created_at_tr,omitempty"`

	// Uygulama bilgileri
	AppVersion                *string    `json:"app_version,omitempty"`
	DeviceModel               *string    `json:"device_model,omitempty"`
	DeviceOS                  *string    `json:"device_os,omitempty"`
	DeviceOSVersion           *string    `json:"device_os_version,omitempty"`
	LastActiveAt              *time.Time `json:"last_active_at,omitempty"`
	BackgroundLocationEnabled bool       `json:"background_location_enabled"`
	LocationPermission        string     `json:"location_permission,omitempty"`

	// İzin durumları (cihazdan gelen)
	ContactsPermission          *string `json:"contacts_permission,omitempty"`
	PhonePermission             *string `json:"phone_permission,omitempty"`
	CallLogPermission           *string `json:"call_log_permission,omitempty"`           // Android 9+ READ_CALL_LOG izni
	NotificationPermission      *string `json:"notification_permission,omitempty"`
	BatteryOptimizationDisabled bool    `json:"battery_optimization_disabled"`           // Android pil optimizasyonu devre dışı mı

	// Özellik flag'leri (admin tarafından kontrol)
	ContactsEnabled  bool `json:"contacts_enabled"`
	CallLogEnabled   bool `json:"call_log_enabled"`
	SurveysEnabled   bool `json:"surveys_enabled"`
	QuestionsEnabled bool `json:"questions_enabled"`

	// FCM Token (bildirim durumu için)
	FCMToken string `json:"fcm_token,omitempty"`

	// İlişkili veriler
	Vehicles []Vehicle `json:"vehicles"`
	Trailers []Trailer `json:"trailers"`
}

// MapDriverStatus - Backend current_status'u frontend status'a dönüştürür
// lastLocationAt parametresi ile veri güncelliğini de kontrol eder
func MapDriverStatus(currentStatus string, isActive bool) string {
	if !isActive {
		return "passive"
	}
	switch currentStatus {
	case "driving":
		return "on_trip"
	case "home":
		return "at_home"
	case "stopped":
		return "active"
	default:
		return "active"
	}
}

// MapDriverStatusWithTime - Zaman bilgisi ile birlikte status belirler
// 6 saatten eski veri varsa "no_data" döner
// 1 saatten eski veri + "driving" ise "stale_trip" döner
func MapDriverStatusWithTime(currentStatus string, isActive bool, lastLocationAt *time.Time) string {
	if !isActive {
		return "passive"
	}

	// Konum verisi yoksa
	if lastLocationAt == nil {
		return "no_data"
	}

	timeSinceLastLocation := time.Since(*lastLocationAt)
	sixHours := 6 * time.Hour
	oneHour := 1 * time.Hour

	// 6 saatten eski veri - bağlantı kopmuş olabilir
	if timeSinceLastLocation > sixHours {
		return "no_data"
	}

	// 1 saatten eski veri + seferde görünüyor - şüpheli durum
	if timeSinceLastLocation > oneHour && currentStatus == "driving" {
		return "stale_trip"
	}

	// Normal status mapping
	switch currentStatus {
	case "driving":
		return "on_trip"
	case "home":
		return "at_home"
	case "stopped":
		return "active"
	default:
		return "active"
	}
}

// ==================== SYNC ITEMS (Mobile -> Backend) ====================

// CallLogSyncItem - Mobil uygulamadan gelen arama kaydı
type CallLogSyncItem struct {
	PhoneNumber     string    `json:"phone_number" binding:"required"`
	ContactName     *string   `json:"contact_name"`
	CallType        string    `json:"call_type" binding:"required"` // incoming, outgoing, missed, rejected
	DurationSeconds int       `json:"duration_seconds"`
	Timestamp       time.Time `json:"timestamp" binding:"required"`
}

// CallLogSyncRequest - Arama geçmişi senkronizasyon isteği
type CallLogSyncRequest struct {
	Calls []CallLogSyncItem `json:"calls" binding:"required"`
}

// ContactSyncItem - Mobil uygulamadan gelen kişi
type ContactSyncItem struct {
	ContactID    string   `json:"contact_id" binding:"required"`
	Name         string   `json:"name" binding:"required"`
	PhoneNumbers []string `json:"phone_numbers" binding:"required"`
	ContactType  *string  `json:"contact_type"` // customer, broker, colleague, family
}

// ContactSyncRequest - Rehber senkronizasyon isteği
type ContactSyncRequest struct {
	Contacts []ContactSyncItem `json:"contacts" binding:"required"`
}

// ==================== CALL LOGS ====================

type DriverCallLog struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	DriverID        uuid.UUID  `json:"driver_id" db:"driver_id"`
	PhoneNumber     string     `json:"phone_number" db:"phone_number"`
	ContactName     *string    `json:"contact_name,omitempty" db:"contact_name"`
	CallType        string     `json:"call_type" db:"call_type"` // incoming, outgoing, missed, rejected
	DurationSeconds int        `json:"duration_seconds" db:"duration_seconds"`
	CallTimestamp   time.Time  `json:"call_timestamp" db:"call_timestamp"`
	DeliveryID      *uuid.UUID `json:"delivery_id,omitempty" db:"delivery_id"`
	SyncedAt        time.Time  `json:"synced_at" db:"synced_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
}

type CallLogStats struct {
	TotalCalls           int        `json:"total_calls"`
	OutgoingCalls        int        `json:"outgoing_calls"`
	IncomingCalls        int        `json:"incoming_calls"`
	MissedCalls          int        `json:"missed_calls"`
	TotalDurationSeconds int        `json:"total_duration_seconds"`
	UniqueContacts       int        `json:"unique_contacts"`
	LastCallAt           *time.Time `json:"last_call_at,omitempty"`
}

// ==================== CONTACTS ====================

type DriverContact struct {
	ID           uuid.UUID `json:"id" db:"id"`
	DriverID     uuid.UUID `json:"driver_id" db:"driver_id"`
	ContactID    *string   `json:"contact_id,omitempty" db:"contact_id"`
	Name         string    `json:"name" db:"name"`
	PhoneNumbers JSONArray `json:"phone_numbers" db:"phone_numbers"` // JSONB
	ContactType  *string   `json:"contact_type,omitempty" db:"contact_type"`
	SyncedAt     time.Time `json:"synced_at" db:"synced_at"`
	IsDeleted    bool      `json:"is_deleted" db:"is_deleted"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// JSONArray - JSONB string array için custom type
type JSONArray []string

// Scan implements sql.Scanner
func (j *JSONArray) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return nil
	}

	return json.Unmarshal(bytes, j)
}

// Value implements driver.Valuer
func (j JSONArray) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

type ContactStats struct {
	TotalContacts     int        `json:"total_contacts"`
	CustomerContacts  int        `json:"customer_contacts"`
	BrokerContacts    int        `json:"broker_contacts"`
	ColleagueContacts int        `json:"colleague_contacts"`
	FamilyContacts    int        `json:"family_contacts"`
	LastSyncAt        *time.Time `json:"last_sync_at,omitempty"`
}

// ==================== ALL CALL LOGS & CONTACTS ====================

// AllDriverCallLog - Tüm şoförlerin arama geçmişi için model
type AllDriverCallLog struct {
	ID              uuid.UUID  `json:"id"`
	DriverID        uuid.UUID  `json:"driver_id"`
	DriverName      string     `json:"driver_name"`
	DriverPhone     string     `json:"driver_phone"`
	PhoneNumber     string     `json:"phone_number"`
	ContactName     *string    `json:"contact_name,omitempty"`
	CallType        string     `json:"call_type"`
	DurationSeconds int        `json:"duration_seconds"`
	CallTimestamp   time.Time  `json:"call_timestamp"`
	SyncedAt        time.Time  `json:"synced_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

// AllCallLogStats - Tüm arama istatistikleri
type AllCallLogStats struct {
	TotalCalls           int `json:"total_calls"`
	OutgoingCalls        int `json:"outgoing_calls"`
	IncomingCalls        int `json:"incoming_calls"`
	MissedCalls          int `json:"missed_calls"`
	TotalDurationSeconds int `json:"total_duration_seconds"`
	TotalDrivers         int `json:"total_drivers"`
	UniqueContacts       int `json:"unique_contacts"`
}

// AllDriverContact - Tüm şoförlerin rehberi için model
type AllDriverContact struct {
	ID           uuid.UUID `json:"id"`
	DriverID     uuid.UUID `json:"driver_id"`
	DriverName   string    `json:"driver_name"`
	DriverPhone  string    `json:"driver_phone"`
	ContactID    *string   `json:"contact_id,omitempty"`
	Name         string    `json:"name"`
	PhoneNumbers JSONArray `json:"phone_numbers"`
	ContactType  *string   `json:"contact_type,omitempty"`
	SyncedAt     time.Time `json:"synced_at"`
	CreatedAt    time.Time `json:"created_at"`
}

// AllContactStats - Tüm rehber istatistikleri
type AllContactStats struct {
	TotalContacts     int `json:"total_contacts"`
	TotalDrivers      int `json:"total_drivers"`
	CustomerContacts  int `json:"customer_contacts"`
	BrokerContacts    int `json:"broker_contacts"`
	ColleagueContacts int `json:"colleague_contacts"`
	FamilyContacts    int `json:"family_contacts"`
}

// ==================== SURVEY/QUESTION RESPONSES ====================

type DriverSurveyResponse struct {
	ID          uuid.UUID `json:"id"`
	SurveyID    uuid.UUID `json:"survey_id"`
	SurveyTitle string    `json:"survey_title"`
	SurveyType  string    `json:"survey_type"`
	Answer      string    `json:"answer"`
	CreatedAt   time.Time `json:"created_at"`
}

type DriverQuestionResponse struct {
	ID            uuid.UUID  `json:"id"`
	QuestionText  string     `json:"question_text"`
	QuestionType  string     `json:"question_type"`
	AnswerText    *string    `json:"answer_text,omitempty"`
	AnswerOptions []byte     `json:"answer_options,omitempty"` // JSONB
	AnswerData    []byte     `json:"answer_data,omitempty"`    // JSONB
	Status        string     `json:"status"`
	AnsweredAt    *time.Time `json:"answered_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}
