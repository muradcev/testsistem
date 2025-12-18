package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// TransportRecord - Taşıma kaydı
type TransportRecord struct {
	ID                  uuid.UUID       `json:"id"`
	DriverID            uuid.UUID       `json:"driver_id"`
	Plate               *string         `json:"plate"`
	TrailerType         *string         `json:"trailer_type"`
	OriginProvince      *string         `json:"origin_province"`
	OriginDistrict      *string         `json:"origin_district"`
	DestinationProvince *string         `json:"destination_province"`
	DestinationDistrict *string         `json:"destination_district"`
	TransportDate       *time.Time      `json:"transport_date"`
	Price               *decimal.Decimal `json:"price"`
	Currency            string          `json:"currency"`
	CargoType           *string         `json:"cargo_type"`
	CargoWeight         *decimal.Decimal `json:"cargo_weight"`
	DistanceKm          *int            `json:"distance_km"`
	Notes               *string         `json:"notes"`
	SourceType          string          `json:"source_type"`
	SourceID            *uuid.UUID      `json:"source_id"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// TransportRecordWithDriver - Şoför bilgisi ile birlikte taşıma kaydı
type TransportRecordWithDriver struct {
	TransportRecord
	DriverName     string  `json:"driver_name"`
	DriverSurname  string  `json:"driver_surname"`
	DriverPhone    string  `json:"driver_phone"`
	DriverProvince *string `json:"driver_province"`
}

// TransportRecordStats - Taşıma kaydı istatistikleri
type TransportRecordStats struct {
	TotalRecords     int             `json:"total_records"`
	TotalDrivers     int             `json:"total_drivers"`
	TotalPrice       decimal.Decimal `json:"total_price"`
	AveragePrice     decimal.Decimal `json:"average_price"`
	MinPrice         decimal.Decimal `json:"min_price"`
	MaxPrice         decimal.Decimal `json:"max_price"`
	TotalDistance    int             `json:"total_distance"`
	TopOrigins       []RouteCount    `json:"top_origins"`
	TopDestinations  []RouteCount    `json:"top_destinations"`
	TopRoutes        []RouteStats    `json:"top_routes"`
	TrailerTypeStats []TrailerStats  `json:"trailer_type_stats"`
}

// RouteCount - İl bazında sayı
type RouteCount struct {
	Province string `json:"province"`
	Count    int    `json:"count"`
}

// RouteStats - Güzergah istatistikleri
type RouteStats struct {
	Origin      string          `json:"origin"`
	Destination string          `json:"destination"`
	Count       int             `json:"count"`
	AvgPrice    decimal.Decimal `json:"avg_price"`
	MinPrice    decimal.Decimal `json:"min_price"`
	MaxPrice    decimal.Decimal `json:"max_price"`
}

// TrailerStats - Dorse tipi istatistikleri
type TrailerStats struct {
	TrailerType string          `json:"trailer_type"`
	Count       int             `json:"count"`
	AvgPrice    decimal.Decimal `json:"avg_price"`
}

// TrailerTypeRef - Dorse tipi referans tablosu
type TrailerTypeRef struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateTransportRecordRequest - Taşıma kaydı oluşturma isteği
type CreateTransportRecordRequest struct {
	DriverID            uuid.UUID `json:"driver_id" binding:"required"`
	Plate               *string   `json:"plate"`
	TrailerType         *string   `json:"trailer_type"`
	OriginProvince      *string   `json:"origin_province"`
	OriginDistrict      *string   `json:"origin_district"`
	DestinationProvince *string   `json:"destination_province"`
	DestinationDistrict *string   `json:"destination_district"`
	TransportDate       *string   `json:"transport_date"` // YYYY-MM-DD format
	Price               *float64  `json:"price"`
	Currency            *string   `json:"currency"`
	CargoType           *string   `json:"cargo_type"`
	CargoWeight         *float64  `json:"cargo_weight"`
	DistanceKm          *int      `json:"distance_km"`
	Notes               *string   `json:"notes"`
	SourceType          *string   `json:"source_type"`
	SourceID            *string   `json:"source_id"`
}

// UpdateTransportRecordRequest - Taşıma kaydı güncelleme isteği
type UpdateTransportRecordRequest struct {
	Plate               *string  `json:"plate"`
	TrailerType         *string  `json:"trailer_type"`
	OriginProvince      *string  `json:"origin_province"`
	OriginDistrict      *string  `json:"origin_district"`
	DestinationProvince *string  `json:"destination_province"`
	DestinationDistrict *string  `json:"destination_district"`
	TransportDate       *string  `json:"transport_date"`
	Price               *float64 `json:"price"`
	Currency            *string  `json:"currency"`
	CargoType           *string  `json:"cargo_type"`
	CargoWeight         *float64 `json:"cargo_weight"`
	DistanceKm          *int     `json:"distance_km"`
	Notes               *string  `json:"notes"`
}
