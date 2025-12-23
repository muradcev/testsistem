package models

import (
	"time"

	"github.com/google/uuid"
)

// LogLevel - Log seviyesi
type LogLevel string

const (
	LogLevelDebug    LogLevel = "debug"
	LogLevelInfo     LogLevel = "info"
	LogLevelWarning  LogLevel = "warning"
	LogLevelError    LogLevel = "error"
	LogLevelCritical LogLevel = "critical"
)

// LogCategory - Log kategorisi
type LogCategory string

const (
	LogCategoryAuth         LogCategory = "auth"
	LogCategoryLocation     LogCategory = "location"
	LogCategoryNetwork      LogCategory = "network"
	LogCategoryUI           LogCategory = "ui"
	LogCategoryBackground   LogCategory = "background"
	LogCategoryNotification LogCategory = "notification"
	LogCategoryTrip         LogCategory = "trip"
	LogCategorySystem       LogCategory = "system"
	LogCategoryPerformance  LogCategory = "performance"
	LogCategoryOther        LogCategory = "other"
)

// AppLog - Uygulama log modeli
type AppLog struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	DriverID    *uuid.UUID             `json:"driver_id,omitempty" db:"driver_id"`
	Level       LogLevel               `json:"level" db:"level"`
	Category    LogCategory            `json:"category" db:"category"`
	Message     string                 `json:"message" db:"message"`
	StackTrace  *string                `json:"stack_trace,omitempty" db:"stack_trace"`
	Metadata    map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	Screen      *string                `json:"screen,omitempty" db:"screen"`
	Action      *string                `json:"action,omitempty" db:"action"`
	DeviceID    *string                `json:"device_id,omitempty" db:"device_id"`
	DeviceModel *string                `json:"device_model,omitempty" db:"device_model"`
	OSVersion   *string                `json:"os_version,omitempty" db:"os_version"`
	AppVersion  *string                `json:"app_version,omitempty" db:"app_version"`
	BuildNumber *string                `json:"build_number,omitempty" db:"build_number"`
	ClientTime  time.Time              `json:"client_time" db:"client_time"`
	ServerTime  time.Time              `json:"server_time" db:"server_time"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
}

// AppLogBatchRequest - Toplu log gönderme isteği
type AppLogBatchRequest struct {
	Logs        []AppLogEntry `json:"logs" binding:"required"`
	DeviceID    string        `json:"device_id"`
	DeviceModel string        `json:"device_model"`
	OSVersion   string        `json:"os_version"`
	AppVersion  string        `json:"app_version"`
	BuildNumber string        `json:"build_number"`
	DriverID    string        `json:"driver_id"`
}

// AppLogEntry - Tek log kaydı (client'tan gelen)
type AppLogEntry struct {
	ID         string                 `json:"id"`
	Level      string                 `json:"level"`
	Category   string                 `json:"category"`
	Message    string                 `json:"message"`
	StackTrace *string                `json:"stack_trace"`
	Metadata   map[string]interface{} `json:"metadata"`
	Timestamp  string                 `json:"timestamp"`
	Screen     *string                `json:"screen"`
	Action     *string                `json:"action"`
}

// AppLogFilter - Log filtreleme
type AppLogFilter struct {
	DriverID  *uuid.UUID
	Level     *LogLevel
	Category  *LogCategory
	StartTime *time.Time
	EndTime   *time.Time
	Search    *string
	Limit     int
	Offset    int
}

// AppLogStats - Log istatistikleri
type AppLogStats struct {
	TotalLogs     int64            `json:"total_logs"`
	ErrorCount    int64            `json:"error_count"`
	CriticalCount int64            `json:"critical_count"`
	ByLevel       map[string]int64 `json:"by_level"`
	ByCategory    map[string]int64 `json:"by_category"`
	ByDevice      map[string]int64 `json:"by_device"`
	Last24Hours   int64            `json:"last_24_hours"`
	Last7Days     int64            `json:"last_7_days"`
}
