package models

import (
	"time"

	"github.com/google/uuid"
)

type LocationType string

const (
	LocationTypeHome        LocationType = "home"
	LocationTypeLoading     LocationType = "loading"
	LocationTypeUnloading   LocationType = "unloading"
	LocationTypeRestArea    LocationType = "rest_area"
	LocationTypeSleep       LocationType = "sleep"
	LocationTypeGasStation  LocationType = "gas_station"
	LocationTypeTruckGarage LocationType = "truck_garage"
	LocationTypeParking     LocationType = "parking"
	LocationTypeIndustrial  LocationType = "industrial"
	LocationTypePort        LocationType = "port"
	LocationTypeCustoms     LocationType = "customs"
	LocationTypeMall        LocationType = "mall"
	LocationTypeUnknown     LocationType = "unknown"
)

var LocationTypeLabels = map[LocationType]string{
	LocationTypeHome:        "Ev",
	LocationTypeLoading:     "Yükleme",
	LocationTypeUnloading:   "Boşaltma",
	LocationTypeRestArea:    "Dinlenme Tesisi",
	LocationTypeSleep:       "Uyku/Mola",
	LocationTypeGasStation:  "Akaryakıt İstasyonu",
	LocationTypeTruckGarage: "TIR Garajı",
	LocationTypeParking:     "Otopark/Park",
	LocationTypeIndustrial:  "Sanayi Bölgesi",
	LocationTypePort:        "Liman",
	LocationTypeCustoms:     "Gümrük",
	LocationTypeMall:        "AVM/Market",
	LocationTypeUnknown:     "Belirlenmedi",
}

type Stop struct {
	ID               uuid.UUID    `json:"id" db:"id"`
	DriverID         uuid.UUID    `json:"driver_id" db:"driver_id"`
	TripID           *uuid.UUID   `json:"trip_id,omitempty" db:"trip_id"`
	Latitude         float64      `json:"latitude" db:"latitude"`
	Longitude        float64      `json:"longitude" db:"longitude"`
	LocationType     LocationType `json:"location_type" db:"location_type"`
	Address          *string      `json:"address,omitempty" db:"address"`
	Province         *string      `json:"province,omitempty" db:"province"`
	District         *string      `json:"district,omitempty" db:"district"`
	StartedAt        time.Time    `json:"started_at" db:"started_at"`
	EndedAt          *time.Time   `json:"ended_at,omitempty" db:"ended_at"`
	DurationMinutes  int          `json:"duration_minutes" db:"duration_minutes"`
	IsInVehicle      bool         `json:"is_in_vehicle" db:"is_in_vehicle"`
	IsDriverSpecific bool         `json:"is_driver_specific" db:"is_driver_specific"` // true for home locations
	HotspotID        *uuid.UUID   `json:"hotspot_id,omitempty" db:"hotspot_id"`       // link to general hotspot
	CreatedAt        time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at" db:"updated_at"`
}

// DriverHome represents a driver's home location (each driver can have 1-2 homes)
type DriverHome struct {
	ID        uuid.UUID `json:"id" db:"id"`
	DriverID  uuid.UUID `json:"driver_id" db:"driver_id"`
	Name      string    `json:"name" db:"name"` // e.g., "Ev 1", "Ev 2"
	Latitude  float64   `json:"latitude" db:"latitude"`
	Longitude float64   `json:"longitude" db:"longitude"`
	Address   *string   `json:"address,omitempty" db:"address"`
	Province  *string   `json:"province,omitempty" db:"province"`
	District  *string   `json:"district,omitempty" db:"district"`
	Radius    float64   `json:"radius" db:"radius"` // detection radius in meters (default 200)
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// GeneralHotspot represents a shared location (loading/unloading points, gas stations, etc.)
type GeneralHotspot struct {
	ID           uuid.UUID    `json:"id" db:"id"`
	Name         string       `json:"name" db:"name"`
	LocationType LocationType `json:"location_type" db:"location_type"`
	Latitude     float64      `json:"latitude" db:"latitude"`
	Longitude    float64      `json:"longitude" db:"longitude"`
	Address      *string      `json:"address,omitempty" db:"address"`
	Province     *string      `json:"province,omitempty" db:"province"`
	District     *string      `json:"district,omitempty" db:"district"`
	Radius       float64      `json:"radius" db:"radius"` // detection radius in meters
	VisitCount   int          `json:"visit_count" db:"visit_count"`
	IsVerified   bool         `json:"is_verified" db:"is_verified"`
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" db:"updated_at"`
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
