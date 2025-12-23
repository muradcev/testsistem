package models

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
)

// FlexibleTime - Timezone bilgisi olan veya olmayan timestamp'leri parse edebilir
type FlexibleTime struct {
	time.Time
}

func (ft *FlexibleTime) UnmarshalJSON(data []byte) error {
	// Remove quotes
	s := strings.Trim(string(data), "\"")
	if s == "null" || s == "" {
		ft.Time = time.Time{}
		return nil
	}

	// Try RFC3339 first (with timezone)
	t, err := time.Parse(time.RFC3339, s)
	if err == nil {
		ft.Time = t
		return nil
	}

	// Try RFC3339Nano (with timezone and nanoseconds)
	t, err = time.Parse(time.RFC3339Nano, s)
	if err == nil {
		ft.Time = t
		return nil
	}

	// Try without timezone (assume UTC)
	t, err = time.Parse("2006-01-02T15:04:05.999999999", s)
	if err == nil {
		ft.Time = t.UTC()
		return nil
	}

	// Try without timezone and without nanoseconds
	t, err = time.Parse("2006-01-02T15:04:05", s)
	if err == nil {
		ft.Time = t.UTC()
		return nil
	}

	return err
}

type ActivityType string

const (
	ActivityTypeDriving  ActivityType = "driving"
	ActivityTypeStill    ActivityType = "still"
	ActivityTypeWalking  ActivityType = "walking"
	ActivityTypeUnknown  ActivityType = "unknown"
)

type Location struct {
	ID           int64        `json:"id" db:"id"`
	DriverID     uuid.UUID    `json:"driver_id" db:"driver_id"`
	VehicleID    *uuid.UUID   `json:"vehicle_id,omitempty" db:"vehicle_id"`
	Latitude     float64      `json:"latitude" db:"latitude"`
	Longitude    float64      `json:"longitude" db:"longitude"`
	Speed        *float64     `json:"speed,omitempty" db:"speed"`
	SpeedKmh     *float64     `json:"speed_kmh,omitempty" db:"speed_kmh"`
	Accuracy     *float64     `json:"accuracy,omitempty" db:"accuracy"`
	Altitude     *float64     `json:"altitude,omitempty" db:"altitude"`
	Heading      *float64     `json:"heading,omitempty" db:"heading"`
	IsMoving     bool         `json:"is_moving" db:"is_moving"`
	ActivityType ActivityType `json:"activity_type" db:"activity_type"`
	BatteryLevel *int         `json:"battery_level,omitempty" db:"battery_level"`
	IsCharging   bool         `json:"is_charging" db:"is_charging"`
	PowerSaveMode bool        `json:"power_save_mode" db:"power_save_mode"`
	PhoneInUse   bool         `json:"phone_in_use" db:"phone_in_use"`

	// Ağ bilgileri
	ConnectionType *string `json:"connection_type,omitempty" db:"connection_type"`
	WifiSsid       *string `json:"wifi_ssid,omitempty" db:"wifi_ssid"`
	IpAddress      *string `json:"ip_address,omitempty" db:"ip_address"`

	// Sensör verileri
	Accelerometer    json.RawMessage `json:"accelerometer,omitempty" db:"accelerometer"`
	Gyroscope        json.RawMessage `json:"gyroscope,omitempty" db:"gyroscope"`
	MaxAccelerationG *float64        `json:"max_acceleration_g,omitempty" db:"max_acceleration_g"`

	// Meta veriler
	Trigger         *string `json:"trigger,omitempty" db:"trigger"`
	IntervalSeconds *int    `json:"interval_seconds,omitempty" db:"interval_seconds"`

	RecordedAt time.Time `json:"recorded_at" db:"recorded_at"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type LocationCreateRequest struct {
	VehicleID    *uuid.UUID   `json:"vehicle_id,omitempty"`
	Latitude     float64      `json:"latitude" binding:"required"`
	Longitude    float64      `json:"longitude" binding:"required"`
	Speed        *float64     `json:"speed,omitempty"`
	SpeedKmh     *float64     `json:"speed_kmh,omitempty"`
	Accuracy     *float64     `json:"accuracy,omitempty"`
	Altitude     *float64     `json:"altitude,omitempty"`
	Heading      *float64     `json:"heading,omitempty"`
	IsMoving     bool         `json:"is_moving"`
	ActivityType ActivityType `json:"activity_type"`
	BatteryLevel *int         `json:"battery_level,omitempty"`
	IsCharging   bool         `json:"is_charging"`
	PowerSaveMode bool        `json:"power_save_mode"`
	PhoneInUse   bool         `json:"phone_in_use"`

	// Ağ bilgileri
	ConnectionType *string `json:"connection_type,omitempty"`
	WifiSsid       *string `json:"wifi_ssid,omitempty"`
	IpAddress      *string `json:"ip_address,omitempty"`

	// Sensör verileri
	Accelerometer    json.RawMessage `json:"accelerometer,omitempty"`
	Gyroscope        json.RawMessage `json:"gyroscope,omitempty"`
	MaxAccelerationG *float64        `json:"max_acceleration_g,omitempty"`

	// Meta veriler
	Trigger         *string `json:"trigger,omitempty"`
	IntervalSeconds *int    `json:"interval_seconds,omitempty"`

	RecordedAt FlexibleTime `json:"recorded_at"`
}

// GetRecordedAt - FlexibleTime'dan time.Time döndürür
func (r *LocationCreateRequest) GetRecordedAt() time.Time {
	return r.RecordedAt.Time
}

type BatchLocationRequest struct {
	Locations []LocationCreateRequest `json:"locations" binding:"required"`
}

type LiveLocation struct {
	DriverID      uuid.UUID    `json:"driver_id"`
	DriverName    string       `json:"driver_name"`
	DriverSurname string       `json:"driver_surname"`
	Province      string       `json:"province,omitempty"`
	District      string       `json:"district,omitempty"`
	Latitude      float64      `json:"latitude"`
	Longitude     float64      `json:"longitude"`
	Speed         *float64     `json:"speed,omitempty"`
	IsMoving      bool         `json:"is_moving"`
	ActivityType  ActivityType `json:"activity_type"`
	CurrentStatus string       `json:"current_status"`
	VehiclePlate  *string      `json:"vehicle_plate,omitempty"`
	PhoneInUse    bool         `json:"phone_in_use"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type LocationFilter struct {
	DriverID  uuid.UUID  `json:"driver_id"`
	StartDate *time.Time `json:"start_date,omitempty"`
	EndDate   *time.Time `json:"end_date,omitempty"`
	Limit     int        `json:"limit,omitempty"`
	Offset    int        `json:"offset,omitempty"`
}
