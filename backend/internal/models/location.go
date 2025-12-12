package models

import (
	"time"

	"github.com/google/uuid"
)

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
	Accuracy     *float64     `json:"accuracy,omitempty" db:"accuracy"`
	Altitude     *float64     `json:"altitude,omitempty" db:"altitude"`
	Heading      *float64     `json:"heading,omitempty" db:"heading"`
	IsMoving     bool         `json:"is_moving" db:"is_moving"`
	ActivityType ActivityType `json:"activity_type" db:"activity_type"`
	BatteryLevel *int         `json:"battery_level,omitempty" db:"battery_level"`
	RecordedAt   time.Time    `json:"recorded_at" db:"recorded_at"`
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
}

type LocationCreateRequest struct {
	VehicleID    *uuid.UUID   `json:"vehicle_id,omitempty"`
	Latitude     float64      `json:"latitude" binding:"required"`
	Longitude    float64      `json:"longitude" binding:"required"`
	Speed        *float64     `json:"speed,omitempty"`
	Accuracy     *float64     `json:"accuracy,omitempty"`
	Altitude     *float64     `json:"altitude,omitempty"`
	Heading      *float64     `json:"heading,omitempty"`
	IsMoving     bool         `json:"is_moving"`
	ActivityType ActivityType `json:"activity_type"`
	BatteryLevel *int         `json:"battery_level,omitempty"`
	RecordedAt   time.Time    `json:"recorded_at"`
}

type BatchLocationRequest struct {
	Locations []LocationCreateRequest `json:"locations" binding:"required"`
}

type LiveLocation struct {
	DriverID      uuid.UUID    `json:"driver_id"`
	DriverName    string       `json:"driver_name"`
	Latitude      float64      `json:"latitude"`
	Longitude     float64      `json:"longitude"`
	Speed         *float64     `json:"speed,omitempty"`
	IsMoving      bool         `json:"is_moving"`
	ActivityType  ActivityType `json:"activity_type"`
	CurrentStatus string       `json:"current_status"`
	VehiclePlate  *string      `json:"vehicle_plate,omitempty"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type LocationFilter struct {
	DriverID  uuid.UUID  `json:"driver_id"`
	StartDate *time.Time `json:"start_date,omitempty"`
	EndDate   *time.Time `json:"end_date,omitempty"`
	Limit     int        `json:"limit,omitempty"`
	Offset    int        `json:"offset,omitempty"`
}
