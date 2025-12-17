package models

import (
	"time"

	"github.com/google/uuid"
)

// Announcement - Admin panelinden mobil uygulamaya gonderilen duyurular
type Announcement struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Title       string     `json:"title" db:"title"`
	Content     string     `json:"content" db:"content"`
	ImageURL    *string    `json:"image_url,omitempty" db:"image_url"`
	LinkURL     *string    `json:"link_url,omitempty" db:"link_url"`
	LinkText    *string    `json:"link_text,omitempty" db:"link_text"`
	Type        string     `json:"type" db:"type"`                   // info, warning, success, promotion
	Priority    int        `json:"priority" db:"priority"`           // Siralama onceligi
	IsActive    bool       `json:"is_active" db:"is_active"`         // Aktif mi?
	IsDismissable bool     `json:"is_dismissable" db:"is_dismissable"` // Kullanici kapatabilir mi?
	StartAt     *time.Time `json:"start_at,omitempty" db:"start_at"` // Ne zaman gosterilmeye baslasin
	EndAt       *time.Time `json:"end_at,omitempty" db:"end_at"`     // Ne zaman gosterilmeyi bitirsin
	TargetType  string     `json:"target_type" db:"target_type"`     // all, province, specific_drivers
	TargetData  *string    `json:"target_data,omitempty" db:"target_data"` // JSON: province listesi veya driver ID listesi
	CreatedBy   uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// AnnouncementCreateRequest - Duyuru olusturma istegi
type AnnouncementCreateRequest struct {
	Title         string     `json:"title" binding:"required"`
	Content       string     `json:"content" binding:"required"`
	ImageURL      *string    `json:"image_url,omitempty"`
	LinkURL       *string    `json:"link_url,omitempty"`
	LinkText      *string    `json:"link_text,omitempty"`
	Type          string     `json:"type" binding:"required"`         // info, warning, success, promotion
	Priority      int        `json:"priority"`
	IsDismissable bool       `json:"is_dismissable"`
	StartAt       *time.Time `json:"start_at,omitempty"`
	EndAt         *time.Time `json:"end_at,omitempty"`
	TargetType    string     `json:"target_type" binding:"required"` // all, province, specific_drivers
	TargetData    *string    `json:"target_data,omitempty"`
}

// AnnouncementUpdateRequest - Duyuru guncelleme istegi
type AnnouncementUpdateRequest struct {
	Title         *string    `json:"title,omitempty"`
	Content       *string    `json:"content,omitempty"`
	ImageURL      *string    `json:"image_url,omitempty"`
	LinkURL       *string    `json:"link_url,omitempty"`
	LinkText      *string    `json:"link_text,omitempty"`
	Type          *string    `json:"type,omitempty"`
	Priority      *int       `json:"priority,omitempty"`
	IsActive      *bool      `json:"is_active,omitempty"`
	IsDismissable *bool      `json:"is_dismissable,omitempty"`
	StartAt       *time.Time `json:"start_at,omitempty"`
	EndAt         *time.Time `json:"end_at,omitempty"`
	TargetType    *string    `json:"target_type,omitempty"`
	TargetData    *string    `json:"target_data,omitempty"`
}

// AnnouncementResponse - Mobil uygulama icin duyuru yaniti
type AnnouncementResponse struct {
	ID            uuid.UUID `json:"id"`
	Title         string    `json:"title"`
	Content       string    `json:"content"`
	ImageURL      *string   `json:"image_url,omitempty"`
	LinkURL       *string   `json:"link_url,omitempty"`
	LinkText      *string   `json:"link_text,omitempty"`
	Type          string    `json:"type"`
	IsDismissable bool      `json:"is_dismissable"`
}
