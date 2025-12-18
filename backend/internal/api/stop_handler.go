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
			"name":             stop.Name,
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
		"stops":  enrichedStops,
		"total":  total,
		"limit":  limit,
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
			"name":             stop.Name,
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
		"stops":  enrichedStops,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// UpdateStopType updates the location type and optionally name for a stop
func (h *StopHandler) UpdateStopType(c *gin.Context) {
	ctx := c.Request.Context()
	stopID := c.Param("id")

	id, err := uuid.Parse(stopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID"})
		return
	}

	var req struct {
		LocationType string  `json:"location_type"`
		Name         *string `json:"name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	// At least one field must be provided
	if req.LocationType == "" && req.Name == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir alan gerekli (location_type veya name)"})
		return
	}

	// If location type provided, validate it
	if req.LocationType != "" {
		locationType := models.LocationType(req.LocationType)
		if _, exists := models.LocationTypeLabels[locationType]; !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak tipi"})
			return
		}

		// Update both type and name
		err = h.stopRepo.UpdateStopTypeAndName(ctx, id, req.LocationType, req.Name)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak güncellenemedi"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":        "Durak güncellendi",
			"location_type":  locationType,
			"location_label": models.LocationTypeLabels[locationType],
			"name":           req.Name,
		})
	} else {
		// Only update name
		err = h.stopRepo.UpdateName(ctx, id, req.Name)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak adı güncellenemedi"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Durak adı güncellendi",
			"name":    req.Name,
		})
	}
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

// GetStopByID returns a single stop by ID
func (h *StopHandler) GetStopByID(c *gin.Context) {
	ctx := c.Request.Context()
	stopID := c.Param("id")

	id, err := uuid.Parse(stopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID"})
		return
	}

	stop, err := h.stopRepo.GetByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak alınamadı"})
		return
	}

	if stop == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Durak bulunamadı"})
		return
	}

	// Get driver info
	driver, _ := h.driverRepo.GetByID(ctx, stop.DriverID)
	driverName := ""
	if driver != nil {
		driverName = driver.Name + " " + driver.Surname
	}

	c.JSON(http.StatusOK, gin.H{
		"stop": map[string]interface{}{
			"id":               stop.ID,
			"driver_id":        stop.DriverID,
			"driver_name":      driverName,
			"name":             stop.Name,
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
		},
	})
}

// DeleteStop deletes a single stop
func (h *StopHandler) DeleteStop(c *gin.Context) {
	ctx := c.Request.Context()
	stopID := c.Param("id")

	id, err := uuid.Parse(stopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID"})
		return
	}

	err = h.stopRepo.Delete(ctx, id)
	if err != nil {
		if err.Error() == "stop not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Durak bulunamadı"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Durak silindi"})
}

// BulkDeleteStops deletes multiple stops
func (h *StopHandler) BulkDeleteStops(c *gin.Context) {
	ctx := c.Request.Context()

	var req struct {
		IDs []string `json:"ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir durak ID gerekli"})
		return
	}

	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, idStr := range req.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID: " + idStr})
			return
		}
		ids = append(ids, id)
	}

	deleted, err := h.stopRepo.BulkDelete(ctx, ids)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duraklar silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Duraklar silindi",
		"deleted": deleted,
	})
}

// BulkUpdateStopType updates location type for multiple stops
func (h *StopHandler) BulkUpdateStopType(c *gin.Context) {
	ctx := c.Request.Context()

	var req struct {
		IDs          []string `json:"ids" binding:"required"`
		LocationType string   `json:"location_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir durak ID gerekli"})
		return
	}

	// Validate location type
	locationType := models.LocationType(req.LocationType)
	if _, exists := models.LocationTypeLabels[locationType]; !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak tipi"})
		return
	}

	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, idStr := range req.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID: " + idStr})
			return
		}
		ids = append(ids, id)
	}

	updated, err := h.stopRepo.BulkUpdateLocationType(ctx, ids, req.LocationType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duraklar güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Duraklar güncellendi",
		"updated":        updated,
		"location_type":  locationType,
		"location_label": models.LocationTypeLabels[locationType],
	})
}
