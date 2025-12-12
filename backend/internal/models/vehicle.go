package models

import (
	"time"

	"github.com/google/uuid"
)

type VehicleType string

const (
	VehicleTypeTruck    VehicleType = "kamyon"
	VehicleTypeTIR      VehicleType = "tir"
	VehicleTypePickup   VehicleType = "kamyonet"
)

type Vehicle struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	DriverID    uuid.UUID   `json:"driver_id" db:"driver_id"`
	Plate       string      `json:"plate" db:"plate"`
	Brand       string      `json:"brand" db:"brand"`
	Model       string      `json:"model" db:"model"`
	Year        int         `json:"year" db:"year"`
	VehicleType VehicleType `json:"vehicle_type" db:"vehicle_type"`
	Tonnage     float64     `json:"tonnage" db:"tonnage"`
	IsActive    bool        `json:"is_active" db:"is_active"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type VehicleCreateRequest struct {
	Plate       string      `json:"plate" binding:"required"`
	Brand       string      `json:"brand" binding:"required"`
	Model       string      `json:"model" binding:"required"`
	Year        int         `json:"year" binding:"required"`
	VehicleType VehicleType `json:"vehicle_type" binding:"required"`
	Tonnage     float64     `json:"tonnage" binding:"required"`
}

type VehicleUpdateRequest struct {
	Plate       string      `json:"plate,omitempty"`
	Brand       string      `json:"brand,omitempty"`
	Model       string      `json:"model,omitempty"`
	Year        int         `json:"year,omitempty"`
	VehicleType VehicleType `json:"vehicle_type,omitempty"`
	Tonnage     float64     `json:"tonnage,omitempty"`
	IsActive    *bool       `json:"is_active,omitempty"`
}

// Popüler araç markaları
var VehicleBrands = []string{
	"Mercedes-Benz",
	"MAN",
	"Volvo",
	"Scania",
	"DAF",
	"Iveco",
	"Renault",
	"Ford",
	"BMC",
	"Isuzu",
	"Mitsubishi",
	"Hino",
	"Hyundai",
	"Fuso",
	"Diğer",
}
