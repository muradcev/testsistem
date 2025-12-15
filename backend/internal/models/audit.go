package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AuditLog - İşlem kayıtları
type AuditLog struct {
	ID           uuid.UUID       `json:"id" db:"id"`
	UserID       *uuid.UUID      `json:"user_id,omitempty" db:"user_id"`
	UserType     string          `json:"user_type" db:"user_type"`     // admin, driver
	UserEmail    *string         `json:"user_email,omitempty" db:"user_email"`
	Action       string          `json:"action" db:"action"`           // login, logout, create, update, delete, view
	ResourceType string          `json:"resource_type" db:"resource_type"` // driver, vehicle, question, trip, etc.
	ResourceID   *uuid.UUID      `json:"resource_id,omitempty" db:"resource_id"`
	Details      json.RawMessage `json:"details,omitempty" db:"details"`
	IPAddress    *string         `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent    *string         `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt    time.Time       `json:"created_at" db:"created_at"`
}

// AuditAction - İşlem türleri
const (
	AuditActionLogin    = "login"
	AuditActionLogout   = "logout"
	AuditActionCreate   = "create"
	AuditActionUpdate   = "update"
	AuditActionDelete   = "delete"
	AuditActionView     = "view"
	AuditActionApprove  = "approve"
	AuditActionReject   = "reject"
	AuditActionSend     = "send"
	AuditActionExport   = "export"
)

// AuditResourceType - Kaynak türleri
const (
	AuditResourceDriver       = "driver"
	AuditResourceVehicle      = "vehicle"
	AuditResourceTrailer      = "trailer"
	AuditResourceQuestion     = "question"
	AuditResourceSurvey       = "survey"
	AuditResourceTrip         = "trip"
	AuditResourceAdmin        = "admin"
	AuditResourceSettings     = "settings"
	AuditResourceNotification = "notification"
)
