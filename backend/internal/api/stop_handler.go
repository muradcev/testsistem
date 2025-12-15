package api

import (
	"net/http"
	"strconv"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type StopHandler struct {
	stopDetection *service.StopDetectionService
	stopRepo      *repository.StopRepository
	driverRepo    *repository.DriverRepository
}

func NewStopHandler(
	stopDetection *service.StopDetectionService,
	stopRepo *repository.StopRepository,
	driverRepo *repository.DriverRepository,
) *StopHandler {
	return &StopHandler{
		stopDetection: stopDetection,
		stopRepo:      stopRepo,
		driverRepo:    driverRepo,
	}
}

// GetStops returns all stops with pagination and optional filters
func (h *StopHandler) GetStops(c *gin.Context) {
	ctx := c.Request.Context()

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	locationType := c.Query("location_type")

	var typePtr *string
	if locationType != "" {
		typePtr = &locationType
	}

	stops, total, err := h.stopRepo.GetAllStops(ctx, limit, offset, typePtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duraklar alınamadı"})
		return
	}

	// Enrich with driver info
	enrichedStops := make([]map[string]interface{}, len(stops))
	for i, stop := range stops {
		driver, _ := h.driverRepo.GetByID(ctx, stop.DriverID)
		driverName := ""
		if driver != nil {
			driverName = driver.Name + " " + driver.Surname
		}

		enrichedStops[i] = map[string]interface{}{
			"id":               stop.ID,
			"driver_id":        stop.DriverID,
			"driver_name":      driverName,
			"latitude":         stop.Latitude,
			"longitude":        stop.Longitude,
			"location_type":    stop.LocationType,
			"location_label":   models.LocationTypeLabels[stop.LocationType],
			"address":          stop.Address,
			"province":         stop.Province,
			"district":         stop.District,
			"started_at":       stop.StartedAt,
			"ended_at":         stop.EndedAt,
			"duration_minutes": stop.DurationMinutes,
			"created_at":       stop.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stops": enrichedStops,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}

// GetUncategorizedStops returns stops that need categorization
func (h *StopHandler) GetUncategorizedStops(c *gin.Context) {
	ctx := c.Request.Context()

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	stops, total, err := h.stopRepo.GetUncategorized(ctx, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duraklar alınamadı"})
		return
	}

	// Enrich with driver info
	enrichedStops := make([]map[string]interface{}, len(stops))
	for i, stop := range stops {
		driver, _ := h.driverRepo.GetByID(ctx, stop.DriverID)
		driverName := ""
		if driver != nil {
			driverName = driver.Name + " " + driver.Surname
		}

		enrichedStops[i] = map[string]interface{}{
			"id":               stop.ID,
			"driver_id":        stop.DriverID,
			"driver_name":      driverName,
			"latitude":         stop.Latitude,
			"longitude":        stop.Longitude,
			"location_type":    stop.LocationType,
			"location_label":   models.LocationTypeLabels[stop.LocationType],
			"address":          stop.Address,
			"province":         stop.Province,
			"district":         stop.District,
			"started_at":       stop.StartedAt,
			"ended_at":         stop.EndedAt,
			"duration_minutes": stop.DurationMinutes,
			"created_at":       stop.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stops": enrichedStops,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}

// UpdateStopType updates the location type for a stop
func (h *StopHandler) UpdateStopType(c *gin.Context) {
	ctx := c.Request.Context()
	stopID := c.Param("id")

	id, err := uuid.Parse(stopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID"})
		return
	}

	var req struct {
		LocationType string `json:"location_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	// Validate location type
	locationType := models.LocationType(req.LocationType)
	if _, exists := models.LocationTypeLabels[locationType]; !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak tipi"})
		return
	}

	err = h.stopDetection.UpdateStopType(ctx, id, locationType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Durak tipi güncellendi",
		"location_type": locationType,
		"location_label": models.LocationTypeLabels[locationType],
	})
}

// DetectStopsForDriver runs stop detection for a specific driver
func (h *StopHandler) DetectStopsForDriver(c *gin.Context) {
	ctx := c.Request.Context()
	driverID := c.Param("driver_id")

	id, err := uuid.Parse(driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	// Get date range from query params (default: last 7 days)
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	if s := c.Query("start_date"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			startDate = t
		}
	}
	if e := c.Query("end_date"); e != "" {
		if t, err := time.Parse("2006-01-02", e); err == nil {
			endDate = t
		}
	}

	stops, err := h.stopDetection.DetectStopsForDriver(ctx, id, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak tespiti başarısız"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Durak tespiti tamamlandı",
		"detected_stops": len(stops),
		"stops": stops,
	})
}

// DetectStopsForAllDrivers runs stop detection for all active drivers
func (h *StopHandler) DetectStopsForAllDrivers(c *gin.Context) {
	ctx := c.Request.Context()

	// Get date range from query params (default: last 7 days)
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	if s := c.Query("start_date"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			startDate = t
		}
	}
	if e := c.Query("end_date"); e != "" {
		if t, err := time.Parse("2006-01-02", e); err == nil {
			endDate = t
		}
	}

	totalStops, err := h.stopDetection.DetectStopsForAllDrivers(ctx, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak tespiti başarısız"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tüm şoförler için durak tespiti tamamlandı",
		"detected_stops": totalStops,
		"start_date": startDate.Format("2006-01-02"),
		"end_date": endDate.Format("2006-01-02"),
	})
}

// GetLocationTypes returns all available location types
func (h *StopHandler) GetLocationTypes(c *gin.Context) {
	types := []map[string]string{}
	for locType, label := range models.LocationTypeLabels {
		types = append(types, map[string]string{
			"value": string(locType),
			"label": label,
		})
	}

	c.JSON(http.StatusOK, gin.H{"location_types": types})
}
