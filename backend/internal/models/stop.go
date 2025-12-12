package models

import (
	"time"

	"github.com/google/uuid"
)

type LocationType string

const (
	LocationTypeHome        LocationType = "home"
	LocationTypeRestArea    LocationType = "rest_area"
	LocationTypeIndustrial  LocationType = "industrial"
	LocationTypeGasStation  LocationType = "gas_station"
	LocationTypePort        LocationType = "port"
	LocationTypeCustoms     LocationType = "customs"
	LocationTypeParking     LocationType = "parking"
	LocationTypeMall        LocationType = "mall"
	LocationTypeUnknown     LocationType = "unknown"
)

var LocationTypeLabels = map[LocationType]string{
	LocationTypeHome:       "Ev",
	LocationTypeRestArea:   "Dinlenme Tesisi",
	LocationTypeIndustrial: "Sanayi Bölgesi",
	LocationTypeGasStation: "Akaryakıt İstasyonu",
	LocationTypePort:       "Liman",
	LocationTypeCustoms:    "Gümrük",
	LocationTypeParking:    "Otopark",
	LocationTypeMall:       "AVM/Market",
	LocationTypeUnknown:    "Bilinmeyen",
}

type Stop struct {
	ID              uuid.UUID    `json:"id" db:"id"`
	DriverID        uuid.UUID    `json:"driver_id" db:"driver_id"`
	TripID          *uuid.UUID   `json:"trip_id,omitempty" db:"trip_id"`
	Latitude        float64      `json:"latitude" db:"latitude"`
	Longitude       float64      `json:"longitude" db:"longitude"`
	LocationType    LocationType `json:"location_type" db:"location_type"`
	Address         *string      `json:"address,omitempty" db:"address"`
	Province        *string      `json:"province,omitempty" db:"province"`
	District        *string      `json:"district,omitempty" db:"district"`
	StartedAt       time.Time    `json:"started_at" db:"started_at"`
	EndedAt         *time.Time   `json:"ended_at,omitempty" db:"ended_at"`
	DurationMinutes int          `json:"duration_minutes" db:"duration_minutes"`
	IsInVehicle     bool         `json:"is_in_vehicle" db:"is_in_vehicle"`
	CreatedAt       time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at" db:"updated_at"`
}

type StopSummary struct {
	LocationType    LocationType `json:"location_type"`
	TotalStops      int          `json:"total_stops"`
	TotalDurationMin int         `json:"total_duration_min"`
	AvgDurationMin  float64      `json:"avg_duration_min"`
}

type StopFilter struct {
	DriverID     uuid.UUID     `json:"driver_id"`
	TripID       *uuid.UUID    `json:"trip_id,omitempty"`
	LocationType *LocationType `json:"location_type,omitempty"`
	StartDate    *time.Time    `json:"start_date,omitempty"`
	EndDate      *time.Time    `json:"end_date,omitempty"`
	MinDuration  *int          `json:"min_duration,omitempty"`
	Limit        int           `json:"limit,omitempty"`
	Offset       int           `json:"offset,omitempty"`
}
