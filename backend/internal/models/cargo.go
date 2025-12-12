package models

import (
	"time"
)

// CargoType - Yük tipi
type CargoType struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Icon        string    `json:"icon" db:"icon"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// VehicleBrand - Araç markası
type VehicleBrand struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	SortOrder int       `json:"sort_order" db:"sort_order"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Models    []VehicleModel `json:"models,omitempty"`
}

// VehicleModel - Araç modeli
type VehicleModel struct {
	ID        string    `json:"id" db:"id"`
	BrandID   string    `json:"brand_id" db:"brand_id"`
	Name      string    `json:"name" db:"name"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// TrailerTypeConfig - Dorse tipi konfigürasyonu (admin panelden yönetilen)
type TrailerTypeConfig struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// TripCargo - Sefer yük bilgisi
type TripCargo struct {
	ID             string    `json:"id" db:"id"`
	TripID         string    `json:"trip_id" db:"trip_id"`
	CargoTypeID    *string   `json:"cargo_type_id" db:"cargo_type_id"`
	CargoTypeOther string    `json:"cargo_type_other" db:"cargo_type_other"`
	WeightTons     float64   `json:"weight_tons" db:"weight_tons"`
	IsFullLoad     bool      `json:"is_full_load" db:"is_full_load"`
	LoadPercentage int       `json:"load_percentage" db:"load_percentage"`
	Description    string    `json:"description" db:"description"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`

	// Join field
	CargoTypeName string `json:"cargo_type_name,omitempty" db:"cargo_type_name"`
}

// TripPricing - Sefer fiyat bilgisi
type TripPricing struct {
	ID            string    `json:"id" db:"id"`
	TripID        string    `json:"trip_id" db:"trip_id"`
	DriverID      string    `json:"driver_id" db:"driver_id"`
	TotalPrice    float64   `json:"total_price" db:"total_price"`
	Currency      string    `json:"currency" db:"currency"`
	PricePerKm    float64   `json:"price_per_km" db:"price_per_km"`
	PriceType     string    `json:"price_type" db:"price_type"` // fixed, per_km, per_ton
	FuelCost      float64   `json:"fuel_cost" db:"fuel_cost"`
	TollCost      float64   `json:"toll_cost" db:"toll_cost"`
	OtherCosts    float64   `json:"other_costs" db:"other_costs"`
	PaidBy        string    `json:"paid_by" db:"paid_by"` // sender, receiver, broker
	PaymentStatus string    `json:"payment_status" db:"payment_status"`
	Source        string    `json:"source" db:"source"` // driver_input, survey, estimate
	RecordedAt    time.Time `json:"recorded_at" db:"recorded_at"`
	Latitude      float64   `json:"latitude" db:"latitude"`
	Longitude     float64   `json:"longitude" db:"longitude"`
}

// PriceSurvey - Fiyat anketi
type PriceSurvey struct {
	ID           string    `json:"id" db:"id"`
	DriverID     string    `json:"driver_id" db:"driver_id"`
	TripID       *string   `json:"trip_id" db:"trip_id"`
	FromProvince string    `json:"from_province" db:"from_province"`
	FromDistrict string    `json:"from_district" db:"from_district"`
	ToProvince   string    `json:"to_province" db:"to_province"`
	ToDistrict   string    `json:"to_district" db:"to_district"`
	Price        float64   `json:"price" db:"price"`
	Currency     string    `json:"currency" db:"currency"`
	CargoTypeID  *string   `json:"cargo_type_id" db:"cargo_type_id"`
	WeightTons   float64   `json:"weight_tons" db:"weight_tons"`
	IsVerified   bool      `json:"is_verified" db:"is_verified"`
	Notes        string    `json:"notes" db:"notes"`
	TripDate     string    `json:"trip_date" db:"trip_date"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`

	// Join fields
	DriverName    string `json:"driver_name,omitempty" db:"driver_name"`
	CargoTypeName string `json:"cargo_type_name,omitempty" db:"cargo_type_name"`
}

// Hotspot - Popüler nokta
type Hotspot struct {
	ID                   string    `json:"id" db:"id"`
	Latitude             float64   `json:"latitude" db:"latitude"`
	Longitude            float64   `json:"longitude" db:"longitude"`
	Name                 string    `json:"name" db:"name"`
	Address              string    `json:"address" db:"address"`
	Province             string    `json:"province" db:"province"`
	District             string    `json:"district" db:"district"`
	SpotType             string    `json:"spot_type" db:"spot_type"` // loading, unloading, rest_area, gas_station, parking, industrial, port, customs, terminal
	VisitCount           int       `json:"visit_count" db:"visit_count"`
	UniqueDrivers        int       `json:"unique_drivers" db:"unique_drivers"`
	AvgDurationMinutes   int       `json:"avg_duration_minutes" db:"avg_duration_minutes"`
	HourlyDistribution   string    `json:"hourly_distribution" db:"hourly_distribution"`
	DailyDistribution    string    `json:"daily_distribution" db:"daily_distribution"`
	IsVerified           bool      `json:"is_verified" db:"is_verified"`
	IsAutoDetected       bool      `json:"is_auto_detected" db:"is_auto_detected"`
	ClusterRadiusMeters  int       `json:"cluster_radius_meters" db:"cluster_radius_meters"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
}

// HotspotVisit - Hotspot ziyareti
type HotspotVisit struct {
	ID              string     `json:"id" db:"id"`
	HotspotID       string     `json:"hotspot_id" db:"hotspot_id"`
	DriverID        string     `json:"driver_id" db:"driver_id"`
	TripID          *string    `json:"trip_id" db:"trip_id"`
	StopID          *string    `json:"stop_id" db:"stop_id"`
	ArrivedAt       time.Time  `json:"arrived_at" db:"arrived_at"`
	DepartedAt      *time.Time `json:"departed_at" db:"departed_at"`
	DurationMinutes int        `json:"duration_minutes" db:"duration_minutes"`
	VisitOrder      int        `json:"visit_order" db:"visit_order"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
}

// RouteSegment - Güzergah segmenti
type RouteSegment struct {
	ID                 string     `json:"id" db:"id"`
	FromProvince       string     `json:"from_province" db:"from_province"`
	FromDistrict       string     `json:"from_district" db:"from_district"`
	FromLatitude       float64    `json:"from_latitude" db:"from_latitude"`
	FromLongitude      float64    `json:"from_longitude" db:"from_longitude"`
	ToProvince         string     `json:"to_province" db:"to_province"`
	ToDistrict         string     `json:"to_district" db:"to_district"`
	ToLatitude         float64    `json:"to_latitude" db:"to_latitude"`
	ToLongitude        float64    `json:"to_longitude" db:"to_longitude"`
	TripCount          int        `json:"trip_count" db:"trip_count"`
	UniqueDrivers      int        `json:"unique_drivers" db:"unique_drivers"`
	AvgDistanceKm      float64    `json:"avg_distance_km" db:"avg_distance_km"`
	AvgDurationMinutes int        `json:"avg_duration_minutes" db:"avg_duration_minutes"`
	AvgPrice           float64    `json:"avg_price" db:"avg_price"`
	MinPrice           float64    `json:"min_price" db:"min_price"`
	MaxPrice           float64    `json:"max_price" db:"max_price"`
	PricePerKmAvg      float64    `json:"price_per_km_avg" db:"price_per_km_avg"`
	LastTripAt         *time.Time `json:"last_trip_at" db:"last_trip_at"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}

// DailyStats - Günlük istatistikler
type DailyStats struct {
	ID                      string    `json:"id" db:"id"`
	StatDate                string    `json:"stat_date" db:"stat_date"`
	ActiveDrivers           int       `json:"active_drivers" db:"active_drivers"`
	NewDrivers              int       `json:"new_drivers" db:"new_drivers"`
	DriversOnTrip           int       `json:"drivers_on_trip" db:"drivers_on_trip"`
	TotalTrips              int       `json:"total_trips" db:"total_trips"`
	CompletedTrips          int       `json:"completed_trips" db:"completed_trips"`
	TotalDistanceKm         float64   `json:"total_distance_km" db:"total_distance_km"`
	AvgTripDistanceKm       float64   `json:"avg_trip_distance_km" db:"avg_trip_distance_km"`
	AvgPrice                float64   `json:"avg_price" db:"avg_price"`
	AvgPricePerKm           float64   `json:"avg_price_per_km" db:"avg_price_per_km"`
	TotalRevenue            float64   `json:"total_revenue" db:"total_revenue"`
	TotalCargoTons          float64   `json:"total_cargo_tons" db:"total_cargo_tons"`
	ProvinceDistribution    string    `json:"province_distribution" db:"province_distribution"`
	CargoTypeDistribution   string    `json:"cargo_type_distribution" db:"cargo_type_distribution"`
	CreatedAt               time.Time `json:"created_at" db:"created_at"`
}

// MobileConfig - Mobil uygulama konfigürasyonu
type MobileConfig struct {
	// Konum güncelleme ayarları
	LocationUpdateIntervalMoving     int `json:"location_update_interval_moving"`     // Hareket halindeyken güncelleme aralığı (saniye)
	LocationUpdateIntervalStationary int `json:"location_update_interval_stationary"` // Durunca güncelleme aralığı (saniye)
	MinimumDisplacementMeters        int `json:"minimum_displacement_meters"`         // Minimum yer değişikliği (metre)
	FastMovingThresholdKmh           int `json:"fast_moving_threshold_kmh"`           // Hızlı hareket eşiği (km/sa)
	FastMovingIntervalSeconds        int `json:"fast_moving_interval_seconds"`        // Hızlı hareket güncelleme aralığı

	// Pil optimizasyonu ayarları
	BatteryOptimizationEnabled  bool `json:"battery_optimization_enabled"`   // Pil optimizasyonu aktif mi
	LocationAccuracyMode        string `json:"location_accuracy_mode"`       // high, balanced, low_power
	LowBatteryThreshold         int  `json:"low_battery_threshold"`          // Düşük pil eşiği (%)
	LowBatteryIntervalSeconds   int  `json:"low_battery_interval_seconds"`   // Düşük pilde güncelleme aralığı

	// Offline mod ayarları
	OfflineModeEnabled          bool `json:"offline_mode_enabled"`           // Offline mod aktif mi
	MaxOfflineLocations         int  `json:"max_offline_locations"`          // Maksimum offline konum sayısı
	OfflineSyncIntervalMinutes  int  `json:"offline_sync_interval_minutes"`  // Offline sync aralığı (dakika)
	SyncOnWifiOnly              bool `json:"sync_on_wifi_only"`              // Sadece WiFi'da sync yap
	MaxOfflineDataSizeMB        int  `json:"max_offline_data_size_mb"`       // Maksimum offline veri boyutu (MB)

	// Aktivite algılama
	ActivityRecognitionEnabled  bool `json:"activity_recognition_enabled"`   // Aktivite algılama aktif mi
	StopDetectionEnabled        bool `json:"stop_detection_enabled"`         // Durak algılama aktif mi
	StopDetectionRadiusMeters   int  `json:"stop_detection_radius_meters"`   // Durak algılama yarıçapı
	StopDetectionMinMinutes     int  `json:"stop_detection_min_minutes"`     // Minimum durak süresi (dakika)

	// Genel ayarlar
	HeartbeatIntervalMinutes    int  `json:"heartbeat_interval_minutes"`     // Heartbeat aralığı
	DataRetentionDays           int  `json:"data_retention_days"`            // Veri saklama süresi (gün)
	MinAppVersion               string `json:"min_app_version"`              // Minimum uygulama versiyonu
	ForceUpdateEnabled          bool `json:"force_update_enabled"`           // Zorunlu güncelleme aktif mi
}

// DefaultMobileConfig - Varsayılan mobil ayarlar
func DefaultMobileConfig() MobileConfig {
	return MobileConfig{
		// Konum güncelleme
		LocationUpdateIntervalMoving:     30,
		LocationUpdateIntervalStationary: 300,
		MinimumDisplacementMeters:        50,
		FastMovingThresholdKmh:           80,
		FastMovingIntervalSeconds:        15,

		// Pil optimizasyonu
		BatteryOptimizationEnabled:  true,
		LocationAccuracyMode:        "balanced",
		LowBatteryThreshold:         20,
		LowBatteryIntervalSeconds:   600,

		// Offline mod
		OfflineModeEnabled:          true,
		MaxOfflineLocations:         500,
		OfflineSyncIntervalMinutes:  5,
		SyncOnWifiOnly:              false,
		MaxOfflineDataSizeMB:        50,

		// Aktivite algılama
		ActivityRecognitionEnabled:  true,
		StopDetectionEnabled:        true,
		StopDetectionRadiusMeters:   100,
		StopDetectionMinMinutes:     10,

		// Genel
		HeartbeatIntervalMinutes:    15,
		DataRetentionDays:           90,
		MinAppVersion:               "1.0.0",
		ForceUpdateEnabled:          false,
	}
}

// AppConfig - Mobil uygulama için konfigürasyon
type AppConfig struct {
	CargoTypes    []CargoType         `json:"cargo_types"`
	VehicleBrands []VehicleBrand      `json:"vehicle_brands"`
	TrailerTypes  []TrailerTypeConfig `json:"trailer_types"`
	MobileConfig  MobileConfig        `json:"mobile_config"`
	Settings      map[string]string   `json:"settings,omitempty"`
}

// RoutePriceMatrix - Fiyat matrisi görünümü
type RoutePriceMatrix struct {
	FromProvince    string  `json:"from_province" db:"from_province"`
	ToProvince      string  `json:"to_province" db:"to_province"`
	TripCount       int     `json:"trip_count" db:"trip_count"`
	AvgDistanceKm   float64 `json:"avg_distance_km" db:"avg_distance_km"`
	AvgPrice        float64 `json:"avg_price" db:"avg_price"`
	PricePerKmAvg   float64 `json:"price_per_km_avg" db:"price_per_km_avg"`
	ConfidenceLevel string  `json:"confidence_level" db:"confidence_level"`
}
