package models

import (
	"time"

	"github.com/google/uuid"
)

type TrailerType string

const (
	TrailerTypeTenteli     TrailerType = "tenteli"
	TrailerTypeKapaliKasa  TrailerType = "kapali_kasa"
	TrailerTypeAcikKasa    TrailerType = "acik_kasa"
	TrailerTypeFrigorifik  TrailerType = "frigorifik"
	TrailerTypeTanker      TrailerType = "tanker"
	TrailerTypeSilobas     TrailerType = "silobas"
	TrailerTypeLowbed      TrailerType = "lowbed"
	TrailerTypeKonteyner   TrailerType = "konteyner"
	TrailerTypeDamperli    TrailerType = "damperli"
	TrailerTypeAracTasiyici TrailerType = "arac_tasiyici"
	TrailerTypeSal         TrailerType = "sal"
)

var TrailerTypeLabels = map[TrailerType]string{
	TrailerTypeTenteli:      "Tenteli (Perdeli)",
	TrailerTypeKapaliKasa:   "Kapalı Kasa",
	TrailerTypeAcikKasa:     "Açık Kasa",
	TrailerTypeFrigorifik:   "Frigorifik (Soğutmalı)",
	TrailerTypeTanker:       "Tanker (Sıvı)",
	TrailerTypeSilobas:      "Silobas (Toz/Granül)",
	TrailerTypeLowbed:       "Lowbed (Alçak)",
	TrailerTypeKonteyner:    "Konteyner Taşıyıcı",
	TrailerTypeDamperli:     "Damperli",
	TrailerTypeAracTasiyici: "Araç Taşıyıcı",
	TrailerTypeSal:          "Sal (Flatbed)",
}

type Trailer struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	DriverID    uuid.UUID   `json:"driver_id" db:"driver_id"`
	Plate       string      `json:"plate" db:"plate"`
	TrailerType TrailerType `json:"trailer_type" db:"trailer_type"`
	IsActive    bool        `json:"is_active" db:"is_active"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type TrailerCreateRequest struct {
	Plate       string      `json:"plate" binding:"required"`
	TrailerType TrailerType `json:"trailer_type" binding:"required"`
}

type TrailerUpdateRequest struct {
	Plate       string      `json:"plate,omitempty"`
	TrailerType TrailerType `json:"trailer_type,omitempty"`
	IsActive    *bool       `json:"is_active,omitempty"`
}
