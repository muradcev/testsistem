package models

import (
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
	CurrentStatus  string     `json:"current_status"`
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
	HasApp         bool       `json:"has_app"` // app_version != null ise true
}

// DeviceInfoRequest - Mobil uygulamadan gelen cihaz bilgisi
type DeviceInfoRequest struct {
	AppVersion                string `json:"app_version" binding:"required"`
	AppBuildNumber            int    `json:"app_build_number"`
	DeviceModel               string `json:"device_model" binding:"required"`
	DeviceOS                  string `json:"device_os" binding:"required"` // ios veya android
	DeviceOSVersion           string `json:"device_os_version"`
	PushEnabled               bool   `json:"push_enabled"`
	LocationPermission        string `json:"location_permission"`        // always, when_in_use, denied, unknown
	BackgroundLocationEnabled bool   `json:"background_location_enabled"`
	FCMToken                  string `json:"fcm_token,omitempty"`
}

// DriverAppStats - Admin panel için uygulama istatistikleri
type DriverAppStats struct {
	TotalDrivers       int `json:"total_drivers"`
	DriversWithApp     int `json:"drivers_with_app"`
	IOSCount           int `json:"ios_count"`
	AndroidCount       int `json:"android_count"`
	ActiveLast24h      int `json:"active_last_24h"`
	ActiveLast7d       int `json:"active_last_7d"`
	NeverActive        int `json:"never_active"`
	PushEnabledCount   int `json:"push_enabled_count"`
	BackgroundLocCount int `json:"background_loc_count"`
}
