package models

import (
	"time"

	"github.com/google/uuid"
)

type TripStatus string

const (
	TripStatusOngoing   TripStatus = "ongoing"
	TripStatusCompleted TripStatus = "completed"
)

type Trip struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	DriverID       uuid.UUID  `json:"driver_id" db:"driver_id"`
	VehicleID      *uuid.UUID `json:"vehicle_id,omitempty" db:"vehicle_id"`
	StartLatitude  float64    `json:"start_latitude" db:"start_latitude"`
	StartLongitude float64    `json:"start_longitude" db:"start_longitude"`
	StartAddress   *string    `json:"start_address,omitempty" db:"start_address"`
	StartProvince  *string    `json:"start_province,omitempty" db:"start_province"`
	EndLatitude    *float64   `json:"end_latitude,omitempty" db:"end_latitude"`
	EndLongitude   *float64   `json:"end_longitude,omitempty" db:"end_longitude"`
	EndAddress     *string    `json:"end_address,omitempty" db:"end_address"`
	EndProvince    *string    `json:"end_province,omitempty" db:"end_province"`
	DistanceKm     float64    `json:"distance_km" db:"distance_km"`
	DurationMinutes int       `json:"duration_minutes" db:"duration_minutes"`
	StartedAt      time.Time  `json:"started_at" db:"started_at"`
	EndedAt        *time.Time `json:"ended_at,omitempty" db:"ended_at"`
	Status         TripStatus `json:"status" db:"status"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

type TripWithStops struct {
	Trip
	Stops []Stop `json:"stops"`
}

type TripSummary struct {
	TotalTrips       int     `json:"total_trips"`
	TotalDistanceKm  float64 `json:"total_distance_km"`
	TotalDurationMin int     `json:"total_duration_min"`
	AvgDistanceKm    float64 `json:"avg_distance_km"`
	AvgDurationMin   float64 `json:"avg_duration_min"`
}
