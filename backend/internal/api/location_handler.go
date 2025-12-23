package api

import (
	"net/http"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/service"
	"nakliyeo-mobil/internal/websocket"

	"github.com/gin-gonic/gin"
)

type LocationHandler struct {
	locationService   *service.LocationService
	tripService       *service.TripService
	driverService     *service.DriverService
	geocodingService  *service.GeocodingService
	wsHub             *websocket.Hub
}

func NewLocationHandler(locationService *service.LocationService, tripService *service.TripService, driverService *service.DriverService, geocodingService *service.GeocodingService, wsHub *websocket.Hub) *LocationHandler {
	return &LocationHandler{
		locationService:  locationService,
		tripService:      tripService,
		driverService:    driverService,
		geocodingService: geocodingService,
		wsHub:            wsHub,
	}
}

func (h *LocationHandler) SaveLocation(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.LocationCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.locationService.SaveLocation(c.Request.Context(), userID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sürücünün son konum bilgisini güncelle
	status := "stationary"
	if req.IsMoving {
		status = "moving"
	}

	// Reverse geocoding ile il/ilçe bilgisi al
	province, district := "", ""
	if h.geocodingService != nil {
		geoResult := h.geocodingService.ReverseGeocodeAsync(req.Latitude, req.Longitude)
		if geoResult != nil {
			province = geoResult.Province
			district = geoResult.District
		}
	}

	_ = h.driverService.UpdateLocation(c.Request.Context(), userID, req.Latitude, req.Longitude, status, province, district)

	// WebSocket üzerinden konum güncellemesi yayınla
	if h.wsHub != nil {
		driver, _ := h.driverService.GetByID(c.Request.Context(), userID)
		driverName := ""
		status := "unknown"
		if driver != nil {
			driverName = driver.Name + " " + driver.Surname
			status = driver.CurrentStatus
		}

		speed := float64(0)
		if req.Speed != nil {
			speed = *req.Speed
		}

		h.wsHub.BroadcastLocationUpdate(&websocket.LocationUpdate{
			DriverID:  userID.String(),
			Name:      driverName,
			Latitude:  req.Latitude,
			Longitude: req.Longitude,
			Speed:     speed,
			IsMoving:  req.IsMoving,
			Status:    status,
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Konum kaydedildi"})
}

func (h *LocationHandler) SaveBatchLocations(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.BatchLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.locationService.SaveBatchLocations(c.Request.Context(), userID, req.Locations); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sürücünün son konum bilgisini en son konum ile güncelle
	if len(req.Locations) > 0 {
		lastLoc := req.Locations[len(req.Locations)-1]
		status := "stationary"
		if lastLoc.IsMoving {
			status = "moving"
		}

		// Reverse geocoding ile il/ilçe bilgisi al
		province, district := "", ""
		if h.geocodingService != nil {
			geoResult := h.geocodingService.ReverseGeocodeAsync(lastLoc.Latitude, lastLoc.Longitude)
			if geoResult != nil {
				province = geoResult.Province
				district = geoResult.District
			}
		}

		_ = h.driverService.UpdateLocation(c.Request.Context(), userID, lastLoc.Latitude, lastLoc.Longitude, status, province, district)
	}

	// Toplu konumlardan en son olanı WebSocket üzerinden yayınla
	if h.wsHub != nil && len(req.Locations) > 0 {
		lastLoc := req.Locations[len(req.Locations)-1]
		driver, _ := h.driverService.GetByID(c.Request.Context(), userID)
		driverName := ""
		status := "unknown"
		if driver != nil {
			driverName = driver.Name + " " + driver.Surname
			status = driver.CurrentStatus
		}

		speed := float64(0)
		if lastLoc.Speed != nil {
			speed = *lastLoc.Speed
		}

		h.wsHub.BroadcastLocationUpdate(&websocket.LocationUpdate{
			DriverID:  userID.String(),
			Name:      driverName,
			Latitude:  lastLoc.Latitude,
			Longitude: lastLoc.Longitude,
			Speed:     speed,
			IsMoving:  lastLoc.IsMoving,
			Status:    status,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Konumlar kaydedildi",
		"count":   len(req.Locations),
	})
}
