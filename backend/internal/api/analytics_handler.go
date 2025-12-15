package api

import (
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"
	"nakliyeo-mobil/internal/service"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type AnalyticsHandler struct {
	analyticsRepo    *repository.AnalyticsRepository
	cargoRepo        *repository.CargoRepository
	generatorService *service.AnalyticsGeneratorService
}

func NewAnalyticsHandler(analyticsRepo *repository.AnalyticsRepository, cargoRepo *repository.CargoRepository) *AnalyticsHandler {
	return &AnalyticsHandler{
		analyticsRepo: analyticsRepo,
		cargoRepo:     cargoRepo,
	}
}

// SetGeneratorService - Generator service'i handler'a ekle
func (h *AnalyticsHandler) SetGeneratorService(svc *service.AnalyticsGeneratorService) {
	h.generatorService = svc
}

// ============================================
// Hotspots
// ============================================

func (h *AnalyticsHandler) GetHotspots(c *gin.Context) {
	ctx := c.Request.Context()

	spotType := c.Query("type")
	var verified *bool
	if v := c.Query("verified"); v != "" {
		b := v == "true"
		verified = &b
	}

	hotspots, err := h.analyticsRepo.GetAllHotspots(ctx, spotType, verified)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hotspotlar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"hotspots": hotspots})
}

func (h *AnalyticsHandler) GetHotspot(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	hotspot, err := h.analyticsRepo.GetHotspotByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hotspot bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, hotspot)
}

func (h *AnalyticsHandler) CreateHotspot(c *gin.Context) {
	ctx := c.Request.Context()

	var req models.Hotspot
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.IsVerified = true
	req.IsAutoDetected = false
	if err := h.analyticsRepo.CreateHotspot(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hotspot oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, req)
}

func (h *AnalyticsHandler) UpdateHotspot(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var req models.Hotspot
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.ID = id
	if err := h.analyticsRepo.UpdateHotspot(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hotspot güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, req)
}

func (h *AnalyticsHandler) DeleteHotspot(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if err := h.analyticsRepo.DeleteHotspot(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hotspot silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Hotspot silindi"})
}

func (h *AnalyticsHandler) DetectHotspots(c *gin.Context) {
	ctx := c.Request.Context()

	minVisits := 5
	clusterRadius := 200

	if v := c.Query("min_visits"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			minVisits = i
		}
	}
	if v := c.Query("cluster_radius"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			clusterRadius = i
		}
	}

	count, err := h.analyticsRepo.DetectHotspots(ctx, minVisits, clusterRadius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hotspot algılama başarısız"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Hotspot algılama tamamlandı",
		"detected_count": count,
	})
}

func (h *AnalyticsHandler) GetNearbyHotspots(c *gin.Context) {
	ctx := c.Request.Context()

	lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
	lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
	radius := 5000 // Default 5km

	if r := c.Query("radius"); r != "" {
		if i, err := strconv.Atoi(r); err == nil {
			radius = i
		}
	}

	hotspots, err := h.analyticsRepo.GetHotspotsNearLocation(ctx, lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Yakın hotspotlar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"hotspots": hotspots})
}

// ============================================
// Route Segments & Price Matrix
// ============================================

func (h *AnalyticsHandler) GetRouteSegments(c *gin.Context) {
	ctx := c.Request.Context()

	fromProvince := c.Query("from_province")
	toProvince := c.Query("to_province")

	segments, err := h.analyticsRepo.GetRouteSegments(ctx, fromProvince, toProvince)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Güzergah segmentleri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"route_segments": segments})
}

func (h *AnalyticsHandler) GetPriceMatrix(c *gin.Context) {
	ctx := c.Request.Context()

	matrix, err := h.analyticsRepo.GetRoutePriceMatrix(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fiyat matrisi alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"price_matrix": matrix})
}

// ============================================
// Daily Stats
// ============================================

func (h *AnalyticsHandler) GetDailyStats(c *gin.Context) {
	ctx := c.Request.Context()

	// Default son 30 gün
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

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

	stats, err := h.analyticsRepo.GetDailyStats(ctx, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Günlük istatistikler alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"daily_stats": stats})
}

func (h *AnalyticsHandler) GenerateDailyStats(c *gin.Context) {
	ctx := c.Request.Context()

	dateStr := c.Query("date")
	date := time.Now().AddDate(0, 0, -1) // Varsayılan dün

	if dateStr != "" {
		if t, err := time.Parse("2006-01-02", dateStr); err == nil {
			date = t
		}
	}

	if err := h.analyticsRepo.GenerateDailyStats(ctx, date); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "İstatistik oluşturulamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "İstatistik oluşturuldu", "date": date.Format("2006-01-02")})
}

// ============================================
// Driver Routes
// ============================================

func (h *AnalyticsHandler) GetDriverRoutes(c *gin.Context) {
	ctx := c.Request.Context()
	driverID := c.Param("driver_id")

	// Default son 30 gün
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

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

	routes, err := h.analyticsRepo.GetDriverRoutes(ctx, driverID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Güzergahlar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"routes": routes})
}

func (h *AnalyticsHandler) GetTripDetails(c *gin.Context) {
	ctx := c.Request.Context()
	tripID := c.Param("trip_id")

	locations, err := h.analyticsRepo.GetTripLocations(ctx, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konum verileri alınamadı"})
		return
	}

	stops, err := h.analyticsRepo.GetTripStops(ctx, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Durak verileri alınamadı"})
		return
	}

	cargo, _ := h.cargoRepo.GetTripCargo(ctx, tripID)
	pricing, _ := h.cargoRepo.GetTripPricing(ctx, tripID)

	c.JSON(http.StatusOK, gin.H{
		"locations": locations,
		"stops":     stops,
		"cargo":     cargo,
		"pricing":   pricing,
	})
}

// ============================================
// Province Analytics
// ============================================

func (h *AnalyticsHandler) GetProvinceStats(c *gin.Context) {
	ctx := c.Request.Context()

	stats, err := h.analyticsRepo.GetProvinceStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "İl istatistikleri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"province_stats": stats})
}

func (h *AnalyticsHandler) GetRouteHeatmap(c *gin.Context) {
	ctx := c.Request.Context()

	heatmap, err := h.analyticsRepo.GetRouteHeatmap(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Heatmap verileri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"heatmap": heatmap})
}

// ============================================
// Price Surveys
// ============================================

func (h *AnalyticsHandler) GetPriceSurveys(c *gin.Context) {
	ctx := c.Request.Context()

	limit := 50
	offset := 0

	if l := c.Query("limit"); l != "" {
		if i, err := strconv.Atoi(l); err == nil {
			limit = i
		}
	}
	if o := c.Query("offset"); o != "" {
		if i, err := strconv.Atoi(o); err == nil {
			offset = i
		}
	}

	surveys, total, err := h.cargoRepo.GetPriceSurveys(ctx, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fiyat anketleri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"price_surveys": surveys,
		"total":         total,
	})
}

func (h *AnalyticsHandler) VerifyPriceSurvey(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var req struct {
		Verified bool `json:"verified"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	if err := h.cargoRepo.VerifyPriceSurvey(ctx, id, req.Verified); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Doğrulama başarısız"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Doğrulama güncellendi"})
}

// ============================================
// Analytics Generation
// ============================================

// GenerateAllAnalytics - Tüm analytics verilerini oluştur
func (h *AnalyticsHandler) GenerateAllAnalytics(c *gin.Context) {
	ctx := c.Request.Context()

	if h.generatorService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analytics generator service not initialized"})
		return
	}

	if err := h.generatorService.RunAllGenerators(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analytics generation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Analytics generation completed"})
}

// GenerateHotspots - Durak verilerinden hotspot oluştur
func (h *AnalyticsHandler) GenerateHotspots(c *gin.Context) {
	ctx := c.Request.Context()

	if h.generatorService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analytics generator service not initialized"})
		return
	}

	minVisits := 1 // Default: en az 1 ziyaret
	if v := c.Query("min_visits"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			minVisits = i
		}
	}

	count, err := h.generatorService.GenerateHotspotsFromStops(ctx, minVisits)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hotspot generation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Hotspots generated from stops",
		"count":   count,
	})
}

// GenerateRouteSegments - Trip verilerinden route segment oluştur
func (h *AnalyticsHandler) GenerateRouteSegments(c *gin.Context) {
	ctx := c.Request.Context()

	if h.generatorService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analytics generator service not initialized"})
		return
	}

	count, err := h.generatorService.GenerateRouteSegments(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Route segment generation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Route segments generated from trips",
		"count":   count,
	})
}

// GetLocationHeatmap - Konum verilerinden heatmap
func (h *AnalyticsHandler) GetLocationHeatmap(c *gin.Context) {
	ctx := c.Request.Context()

	if h.generatorService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analytics generator service not initialized"})
		return
	}

	heatmap, err := h.generatorService.GenerateLocationHeatmap(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Location heatmap failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"heatmap": heatmap})
}

// GetStopHeatmap - Durak verilerinden heatmap
func (h *AnalyticsHandler) GetStopHeatmap(c *gin.Context) {
	ctx := c.Request.Context()

	if h.generatorService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Analytics generator service not initialized"})
		return
	}

	heatmap, err := h.generatorService.GetStopHeatmap(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Stop heatmap failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"heatmap": heatmap})
}
