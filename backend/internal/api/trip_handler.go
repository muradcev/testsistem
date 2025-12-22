package api

import (
	"context"
	"log"
	"net/http"
	"time"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
)

// TripHandler - Sefer ve geofence event'lerini yönetir
type TripHandler struct {
	db repository.PgxPool
}

// NewTripHandler - Yeni TripHandler oluşturur
func NewTripHandler(db repository.PgxPool) *TripHandler {
	return &TripHandler{db: db}
}

// TripEventRequest - Sefer event isteği
type TripEventRequest struct {
	EventType string  `json:"event_type" binding:"required"` // trip_started, trip_ended
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`

	// trip_started için
	StartedAt string `json:"started_at,omitempty"`

	// trip_ended için
	EndedAt                string  `json:"ended_at,omitempty"`
	TotalDistanceKm        float64 `json:"total_distance_km,omitempty"`
	AvgSpeedKmh            float64 `json:"avg_speed_kmh,omitempty"`
	MaxSpeedKmh            float64 `json:"max_speed_kmh,omitempty"`
	TripType               string  `json:"trip_type,omitempty"` // city, highway, longHaul
	DurationMinutes        int     `json:"duration_minutes,omitempty"`
	StartLatitude          float64 `json:"start_latitude,omitempty"`
	StartLongitude         float64 `json:"start_longitude,omitempty"`
	StraightLineDistanceKm float64 `json:"straight_line_distance_km,omitempty"`
}

// TripEvent - Veritabanı modeli
type TripEvent struct {
	ID                     string     `db:"id" json:"id"`
	DriverID               string     `db:"driver_id" json:"driver_id"`
	EventType              string     `db:"event_type" json:"event_type"`
	Latitude               float64    `db:"latitude" json:"latitude"`
	Longitude              float64    `db:"longitude" json:"longitude"`
	StartedAt              *time.Time `db:"started_at" json:"started_at,omitempty"`
	EndedAt                *time.Time `db:"ended_at" json:"ended_at,omitempty"`
	TotalDistanceKm        *float64   `db:"total_distance_km" json:"total_distance_km,omitempty"`
	AvgSpeedKmh            *float64   `db:"avg_speed_kmh" json:"avg_speed_kmh,omitempty"`
	MaxSpeedKmh            *float64   `db:"max_speed_kmh" json:"max_speed_kmh,omitempty"`
	TripType               *string    `db:"trip_type" json:"trip_type,omitempty"`
	DurationMinutes        *int       `db:"duration_minutes" json:"duration_minutes,omitempty"`
	StartLatitude          *float64   `db:"start_latitude" json:"start_latitude,omitempty"`
	StartLongitude         *float64   `db:"start_longitude" json:"start_longitude,omitempty"`
	StraightLineDistanceKm *float64   `db:"straight_line_distance_km" json:"straight_line_distance_km,omitempty"`
	CreatedAt              time.Time  `db:"created_at" json:"created_at"`
}

// SaveTripEvent - Sefer event'ini kaydet
// POST /driver/trip-events
func (h *TripHandler) SaveTripEvent(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req TripEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Desteklenen event type kontrolü
	if req.EventType != "trip_started" && req.EventType != "trip_ended" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz event_type. Desteklenenler: trip_started, trip_ended"})
		return
	}

	log.Printf("[TripEvent] Driver: %s, Type: %s, Lat: %.6f, Lon: %.6f",
		userID, req.EventType, req.Latitude, req.Longitude)

	// Veritabanına kaydet
	query := `
		INSERT INTO trip_events (
			driver_id, event_type, latitude, longitude,
			started_at, ended_at, total_distance_km, avg_speed_kmh,
			max_speed_kmh, trip_type, duration_minutes,
			start_latitude, start_longitude, straight_line_distance_km
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		) RETURNING id, created_at
	`

	var startedAt, endedAt *time.Time
	if req.StartedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.StartedAt); err == nil {
			startedAt = &t
		}
	}
	if req.EndedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.EndedAt); err == nil {
			endedAt = &t
		}
	}

	var id string
	var createdAt time.Time

	ctx := context.Background()
	err := h.db.QueryRow(ctx, query,
		userID, req.EventType, req.Latitude, req.Longitude,
		startedAt, endedAt,
		nullableFloat(req.TotalDistanceKm),
		nullableFloat(req.AvgSpeedKmh),
		nullableFloat(req.MaxSpeedKmh),
		nullableString(req.TripType),
		nullableInt(req.DurationMinutes),
		nullableFloat(req.StartLatitude),
		nullableFloat(req.StartLongitude),
		nullableFloat(req.StraightLineDistanceKm),
	).Scan(&id, &createdAt)

	if err != nil {
		log.Printf("[TripEvent] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kayıt hatası: " + err.Error()})
		return
	}

	log.Printf("[TripEvent] Saved: ID=%s, Driver=%s, Type=%s", id, userID, req.EventType)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Event kaydedildi",
		"id":         id,
		"created_at": createdAt,
	})
}

// GeofenceZone - Geofence bölgesi
type GeofenceZone struct {
	ID           string  `db:"id" json:"id"`
	Name         string  `db:"name" json:"name"`
	Type         string  `db:"type" json:"type"` // warehouse, customer, port, factory, rest_area
	Latitude     float64 `db:"latitude" json:"latitude"`
	Longitude    float64 `db:"longitude" json:"longitude"`
	RadiusMeters float64 `db:"radius_meters" json:"radius_meters"`
	IsActive     bool    `db:"is_active" json:"is_active"`
}

// GetGeofences - Şoför için aktif geofence bölgelerini getir
// GET /driver/geofences
func (h *TripHandler) GetGeofences(c *gin.Context) {
	_, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	// Aktif geofence bölgelerini getir
	query := `
		SELECT id, name, type, latitude, longitude, radius_meters, is_active
		FROM geofence_zones
		WHERE is_active = true
		ORDER BY name
	`

	ctx := context.Background()
	rows, err := h.db.Query(ctx, query)
	if err != nil {
		log.Printf("[Geofence] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Veritabanı hatası"})
		return
	}
	defer rows.Close()

	var zones []GeofenceZone
	for rows.Next() {
		var zone GeofenceZone
		if err := rows.Scan(&zone.ID, &zone.Name, &zone.Type, &zone.Latitude, &zone.Longitude, &zone.RadiusMeters, &zone.IsActive); err != nil {
			log.Printf("[Geofence] Scan Error: %v", err)
			continue
		}
		zones = append(zones, zone)
	}

	c.JSON(http.StatusOK, gin.H{
		"zones": zones,
		"count": len(zones),
	})
}

// GeofenceEventRequest - Geofence event isteği
type GeofenceEventRequest struct {
	ZoneID    string  `json:"zone_id" binding:"required"`
	EventType string  `json:"event_type" binding:"required"` // entered, exited
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
}

// SaveGeofenceEvent - Geofence event'ini kaydet
// POST /driver/geofence-events
func (h *TripHandler) SaveGeofenceEvent(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req GeofenceEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Event type kontrolü
	if req.EventType != "entered" && req.EventType != "exited" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz event_type. Desteklenenler: entered, exited"})
		return
	}

	log.Printf("[GeofenceEvent] Driver: %s, Zone: %s, Type: %s",
		userID, req.ZoneID, req.EventType)

	// Veritabanına kaydet
	query := `
		INSERT INTO geofence_events (
			driver_id, zone_id, event_type, latitude, longitude
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`

	var id string
	var createdAt time.Time

	ctx := context.Background()
	err := h.db.QueryRow(ctx, query,
		userID, req.ZoneID, req.EventType, req.Latitude, req.Longitude,
	).Scan(&id, &createdAt)

	if err != nil {
		log.Printf("[GeofenceEvent] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kayıt hatası: " + err.Error()})
		return
	}

	log.Printf("[GeofenceEvent] Saved: ID=%s, Driver=%s, Zone=%s, Type=%s",
		id, userID, req.ZoneID, req.EventType)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Event kaydedildi",
		"id":         id,
		"created_at": createdAt,
	})
}

// Helper functions
func nullableFloat(f float64) *float64 {
	if f == 0 {
		return nil
	}
	return &f
}

func nullableInt(i int) *int {
	if i == 0 {
		return nil
	}
	return &i
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ==================== ADMIN GEOFENCE CRUD ====================

// GeofenceZoneWithDates - Geofence bölgesi (tarihlerle)
type GeofenceZoneWithDates struct {
	ID           string     `db:"id" json:"id"`
	Name         string     `db:"name" json:"name"`
	Type         string     `db:"type" json:"type"`
	Latitude     float64    `db:"latitude" json:"latitude"`
	Longitude    float64    `db:"longitude" json:"longitude"`
	RadiusMeters float64    `db:"radius_meters" json:"radius_meters"`
	IsActive     bool       `db:"is_active" json:"is_active"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    *time.Time `db:"updated_at" json:"updated_at,omitempty"`
}

// AdminGetGeofences - Tüm geofence bölgelerini listele (admin)
// GET /admin/geofences
func (h *TripHandler) AdminGetGeofences(c *gin.Context) {
	query := `
		SELECT id, name, type, latitude, longitude, radius_meters, is_active, created_at, updated_at
		FROM geofence_zones
		ORDER BY name
	`

	ctx := context.Background()
	rows, err := h.db.Query(ctx, query)
	if err != nil {
		log.Printf("[AdminGeofence] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Veritabanı hatası"})
		return
	}
	defer rows.Close()

	var zones []GeofenceZoneWithDates
	for rows.Next() {
		var zone GeofenceZoneWithDates
		if err := rows.Scan(&zone.ID, &zone.Name, &zone.Type, &zone.Latitude, &zone.Longitude, &zone.RadiusMeters, &zone.IsActive, &zone.CreatedAt, &zone.UpdatedAt); err != nil {
			log.Printf("[AdminGeofence] Scan Error: %v", err)
			continue
		}
		zones = append(zones, zone)
	}

	c.JSON(http.StatusOK, gin.H{
		"zones": zones,
		"count": len(zones),
	})
}

// CreateGeofenceRequest - Geofence oluşturma isteği
type CreateGeofenceRequest struct {
	Name         string  `json:"name" binding:"required"`
	Type         string  `json:"type" binding:"required"`
	Latitude     float64 `json:"latitude" binding:"required"`
	Longitude    float64 `json:"longitude" binding:"required"`
	RadiusMeters float64 `json:"radius_meters" binding:"required"`
	IsActive     bool    `json:"is_active"`
}

// AdminCreateGeofence - Yeni geofence bölgesi oluştur
// POST /admin/geofences
func (h *TripHandler) AdminCreateGeofence(c *gin.Context) {
	var req CreateGeofenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Varsayılan aktif
	if req.RadiusMeters == 0 {
		req.RadiusMeters = 200
	}

	query := `
		INSERT INTO geofence_zones (name, type, latitude, longitude, radius_meters, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`

	var id string
	var createdAt time.Time

	ctx := context.Background()
	err := h.db.QueryRow(ctx, query,
		req.Name, req.Type, req.Latitude, req.Longitude, req.RadiusMeters, req.IsActive,
	).Scan(&id, &createdAt)

	if err != nil {
		log.Printf("[AdminGeofence] Create Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Oluşturma hatası: " + err.Error()})
		return
	}

	log.Printf("[AdminGeofence] Created: ID=%s, Name=%s, Type=%s", id, req.Name, req.Type)

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Geofence bölgesi oluşturuldu",
		"id":         id,
		"created_at": createdAt,
	})
}

// UpdateGeofenceRequest - Geofence güncelleme isteği
type UpdateGeofenceRequest struct {
	Name         *string  `json:"name,omitempty"`
	Type         *string  `json:"type,omitempty"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
	RadiusMeters *float64 `json:"radius_meters,omitempty"`
	IsActive     *bool    `json:"is_active,omitempty"`
}

// AdminUpdateGeofence - Geofence bölgesini güncelle
// PUT /admin/geofences/:id
func (h *TripHandler) AdminUpdateGeofence(c *gin.Context) {
	zoneID := c.Param("id")

	var req UpdateGeofenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Dinamik güncelleme
	query := `
		UPDATE geofence_zones SET
			name = COALESCE($1, name),
			type = COALESCE($2, type),
			latitude = COALESCE($3, latitude),
			longitude = COALESCE($4, longitude),
			radius_meters = COALESCE($5, radius_meters),
			is_active = COALESCE($6, is_active),
			updated_at = NOW()
		WHERE id = $7
	`

	ctx := context.Background()
	result, err := h.db.Exec(ctx, query,
		req.Name, req.Type, req.Latitude, req.Longitude, req.RadiusMeters, req.IsActive, zoneID,
	)

	if err != nil {
		log.Printf("[AdminGeofence] Update Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Güncelleme hatası: " + err.Error()})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Geofence bölgesi bulunamadı"})
		return
	}

	log.Printf("[AdminGeofence] Updated: ID=%s", zoneID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Geofence bölgesi güncellendi",
		"id":      zoneID,
	})
}

// AdminDeleteGeofence - Geofence bölgesini sil
// DELETE /admin/geofences/:id
func (h *TripHandler) AdminDeleteGeofence(c *gin.Context) {
	zoneID := c.Param("id")

	query := `DELETE FROM geofence_zones WHERE id = $1`

	ctx := context.Background()
	result, err := h.db.Exec(ctx, query, zoneID)

	if err != nil {
		log.Printf("[AdminGeofence] Delete Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Silme hatası: " + err.Error()})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Geofence bölgesi bulunamadı"})
		return
	}

	log.Printf("[AdminGeofence] Deleted: ID=%s", zoneID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Geofence bölgesi silindi",
		"id":      zoneID,
	})
}
