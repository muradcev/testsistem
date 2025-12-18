package api

import (
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
)

type RoutingHandler struct {
	routingService *service.RoutingService
}

func NewRoutingHandler(routingService *service.RoutingService) *RoutingHandler {
	return &RoutingHandler{routingService: routingService}
}

// GetRouteDistance - İki nokta arası karayolu mesafesi hesapla
// GET /api/v1/routing/distance?from_lat=39.9334&from_lon=32.8597&to_lat=41.0082&to_lon=29.0121
func (h *RoutingHandler) GetRouteDistance(c *gin.Context) {
	fromLat, err := strconv.ParseFloat(c.Query("from_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lat geçersiz"})
		return
	}

	fromLon, err := strconv.ParseFloat(c.Query("from_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lon geçersiz"})
		return
	}

	toLat, err := strconv.ParseFloat(c.Query("to_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lat geçersiz"})
		return
	}

	toLon, err := strconv.ParseFloat(c.Query("to_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lon geçersiz"})
		return
	}

	result, err := h.routingService.GetRouteDistance(c.Request.Context(), fromLat, fromLon, toLat, toLon)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"from": gin.H{
			"latitude":  fromLat,
			"longitude": fromLon,
		},
		"to": gin.H{
			"latitude":  toLat,
			"longitude": toLon,
		},
		"distance_km":      result.DistanceKm,
		"distance_meters":  result.DistanceMeters,
		"duration_minutes": result.DurationMinutes,
		"duration_seconds": result.DurationSeconds,
	})
}

// GetRouteDistanceWithFallback - Karayolu mesafesi, OSRM çalışmazsa Haversine kullan
func (h *RoutingHandler) GetRouteDistanceWithFallback(c *gin.Context) {
	fromLat, err := strconv.ParseFloat(c.Query("from_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lat geçersiz"})
		return
	}

	fromLon, err := strconv.ParseFloat(c.Query("from_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lon geçersiz"})
		return
	}

	toLat, err := strconv.ParseFloat(c.Query("to_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lat geçersiz"})
		return
	}

	toLon, err := strconv.ParseFloat(c.Query("to_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lon geçersiz"})
		return
	}

	distance, isRoadDistance, err := h.routingService.CalculateRouteDistanceWithFallback(c.Request.Context(), fromLat, fromLon, toLat, toLon)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	distanceType := "road"
	if !isRoadDistance {
		distanceType = "straight_line"
	}

	c.JSON(http.StatusOK, gin.H{
		"from": gin.H{
			"latitude":  fromLat,
			"longitude": fromLon,
		},
		"to": gin.H{
			"latitude":  toLat,
			"longitude": toLon,
		},
		"distance_km":   distance,
		"distance_type": distanceType,
	})
}

// CheckOSRMStatus - OSRM sunucusunun durumunu kontrol et
func (h *RoutingHandler) CheckOSRMStatus(c *gin.Context) {
	available := h.routingService.IsAvailable(c.Request.Context())

	status := "unavailable"
	if available {
		status = "available"
	}

	c.JSON(http.StatusOK, gin.H{
		"osrm_status": status,
		"available":   available,
	})
}
