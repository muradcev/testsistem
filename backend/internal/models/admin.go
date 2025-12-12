package models

import (
	"time"

	"github.com/google/uuid"
)

type AdminRole string

const (
	AdminRoleSuperAdmin AdminRole = "super_admin"
	AdminRoleAdmin      AdminRole = "admin"
	AdminRoleViewer     AdminRole = "viewer"
)

type AdminUser struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Name         string    `json:"name" db:"name"`
	Role         AdminRole `json:"role" db:"role"`
	IsActive     bool      `json:"is_active" db:"is_active"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AdminCreateRequest struct {
	Email    string    `json:"email" binding:"required,email"`
	Password string    `json:"password" binding:"required,min=8"`
	Name     string    `json:"name" binding:"required"`
	Role     AdminRole `json:"role" binding:"required"`
}

type Setting struct {
	Key         string    `json:"key" db:"key"`
	Value       string    `json:"value" db:"value"`
	Description string    `json:"description" db:"description"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type SettingsUpdateRequest struct {
	Settings map[string]string `json:"settings" binding:"required"`
}

// Dashboard için
type DashboardStats struct {
	TotalDrivers       int     `json:"total_drivers"`
	ActiveDrivers      int     `json:"active_drivers"`
	DriversOnTrip      int     `json:"drivers_on_trip"`
	DriversAtHome      int     `json:"drivers_at_home"`
	TotalVehicles      int     `json:"total_vehicles"`
	TodayTrips         int     `json:"today_trips"`
	TodayDistanceKm    float64 `json:"today_distance_km"`
	PendingSurveys     int     `json:"pending_surveys"`
	SurveyResponseRate float64 `json:"survey_response_rate"`
}

// Route Analysis
type RouteAnalysis struct {
	StartProvince   string  `json:"start_province"`
	EndProvince     string  `json:"end_province"`
	TripCount       int     `json:"trip_count"`
	AvgDistanceKm   float64 `json:"avg_distance_km"`
	AvgDurationMin  float64 `json:"avg_duration_min"`
	TotalDistanceKm float64 `json:"total_distance_km"`
}

// Stop Analysis
type StopAnalysis struct {
	Province        string       `json:"province"`
	District        string       `json:"district"`
	LocationType    LocationType `json:"location_type"`
	StopCount       int          `json:"stop_count"`
	AvgDurationMin  float64      `json:"avg_duration_min"`
	TotalDurationMin int         `json:"total_duration_min"`
}
