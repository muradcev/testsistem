package api

import (
	"net/http"
	"strconv"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminHandler struct {
	adminService    *service.AdminService
	driverService   *service.DriverService
	locationService *service.LocationService
	tripService     *service.TripService
	surveyService   *service.SurveyService
	vehicleService  *service.VehicleService
	trailerService  *service.TrailerService
}

func NewAdminHandler(
	adminService *service.AdminService,
	driverService *service.DriverService,
	locationService *service.LocationService,
	tripService *service.TripService,
	surveyService *service.SurveyService,
	vehicleService *service.VehicleService,
	trailerService *service.TrailerService,
) *AdminHandler {
	return &AdminHandler{
		adminService:    adminService,
		driverService:   driverService,
		locationService: locationService,
		tripService:     tripService,
		surveyService:   surveyService,
		vehicleService:  vehicleService,
		trailerService:  trailerService,
	}
}

func (h *AdminHandler) GetDashboard(c *gin.Context) {
	ctx := c.Request.Context()

	// Driver stats
	totalDrivers, activeDrivers, onTrip, atHome, err := h.driverService.GetStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Trip stats
	todayTrips, todayDistance, err := h.tripService.GetTodayStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Survey stats
	responseRate, _ := h.surveyService.GetResponseRate(ctx)

	stats := models.DashboardStats{
		TotalDrivers:       totalDrivers,
		ActiveDrivers:      activeDrivers,
		DriversOnTrip:      onTrip,
		DriversAtHome:      atHome,
		TodayTrips:         todayTrips,
		TodayDistanceKm:    todayDistance,
		SurveyResponseRate: responseRate,
	}

	c.JSON(http.StatusOK, stats)
}

func (h *AdminHandler) GetDrivers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	drivers, total, err := h.driverService.GetAll(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"drivers": drivers,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

func (h *AdminHandler) GetDriverDetail(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	ctx := c.Request.Context()

	driver, err := h.driverService.GetByID(ctx, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	// Araçları getir
	vehicles, err := h.vehicleService.GetByDriverID(ctx, driverID)
	if err != nil {
		vehicles = []models.Vehicle{} // Hata durumunda boş liste
	}

	// Dorseleri getir
	trailers, err := h.trailerService.GetByDriverID(ctx, driverID)
	if err != nil {
		trailers = []models.Trailer{} // Hata durumunda boş liste
	}

	// Detay yanıtı oluştur
	response := models.DriverDetailResponse{
		ID:                        driver.ID,
		Phone:                     driver.Phone,
		Name:                      driver.Name,
		Surname:                   driver.Surname,
		Email:                     "", // Email field yoksa boş
		Province:                  driver.Province,
		District:                  driver.District,
		Neighborhood:              driver.Neighborhood,
		HomeLatitude:              driver.HomeLatitude,
		HomeLongitude:             driver.HomeLongitude,
		IsActive:                  driver.IsActive,
		IsPhoneVerified:           driver.IsPhoneVerified,
		Status:                    models.MapDriverStatus(driver.CurrentStatus, driver.IsActive),
		CurrentStatus:             driver.CurrentStatus,
		LastLocationAt:            driver.LastLocationAt,
		LastLatitude:              driver.LastLatitude,
		LastLongitude:             driver.LastLongitude,
		CreatedAt:                 driver.CreatedAt,
		UpdatedAt:                 driver.UpdatedAt,
		AppVersion:                driver.AppVersion,
		DeviceModel:               driver.DeviceModel,
		DeviceOS:                  driver.DeviceOS,
		LastActiveAt:              driver.LastActiveAt,
		BackgroundLocationEnabled: driver.BackgroundLocationEnabled,
		Vehicles:                  vehicles,
		Trailers:                  trailers,
	}

	c.JSON(http.StatusOK, response)
}

func (h *AdminHandler) GetDriverLocations(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	filter := models.LocationFilter{
		DriverID: driverID,
		Limit:    limit,
	}

	// Tarih filtreleri
	if startStr := c.Query("start_date"); startStr != "" {
		if start, err := time.Parse("2006-01-02", startStr); err == nil {
			filter.StartDate = &start
		}
	}
	if endStr := c.Query("end_date"); endStr != "" {
		if end, err := time.Parse("2006-01-02", endStr); err == nil {
			end = end.Add(24 * time.Hour)
			filter.EndDate = &end
		}
	}

	locations, err := h.locationService.GetByDriver(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"locations": locations})
}

func (h *AdminHandler) GetDriverTrips(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	trips, err := h.tripService.GetDriverTrips(c.Request.Context(), driverID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"trips": trips})
}

func (h *AdminHandler) GetDriverStops(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	filter := models.StopFilter{
		DriverID: driverID,
		Limit:    50,
	}

	stops, err := h.tripService.GetDriverStops(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stops": stops})
}

func (h *AdminHandler) GetLiveLocations(c *gin.Context) {
	locations, err := h.locationService.GetAllLiveLocations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"locations": locations})
}

// GetDriverAppStats - Uygulama istatistikleri
func (h *AdminHandler) GetDriverAppStats(c *gin.Context) {
	stats, err := h.driverService.GetDriverAppStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// Notification Handler
type NotificationHandler struct {
	notificationService *service.NotificationService
	driverService       *service.DriverService
}

func NewNotificationHandler(notificationService *service.NotificationService, driverService *service.DriverService) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
		driverService:       driverService,
	}
}

func (h *NotificationHandler) SendNotification(c *gin.Context) {
	var req struct {
		DriverID uuid.UUID `json:"driver_id" binding:"required"`
		Title    string    `json:"title" binding:"required"`
		Body     string    `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driver, err := h.driverService.GetByID(c.Request.Context(), req.DriverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if driver == nil || driver.FCMToken == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Şoför bulunamadı veya FCM token yok"})
		return
	}

	message := &service.NotificationMessage{
		Title: req.Title,
		Body:  req.Body,
	}

	if err := h.notificationService.SendToDevice(c.Request.Context(), *driver.FCMToken, message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Bildirim gönderildi"})
}

func (h *NotificationHandler) BroadcastNotification(c *gin.Context) {
	var req struct {
		Title string `json:"title" binding:"required"`
		Body  string `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	drivers, err := h.driverService.GetDriversWithFCMToken(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var tokens []string
	for _, d := range drivers {
		if d.FCMToken != nil {
			tokens = append(tokens, *d.FCMToken)
		}
	}

	message := &service.NotificationMessage{
		Title: req.Title,
		Body:  req.Body,
	}

	if err := h.notificationService.SendToDevices(c.Request.Context(), tokens, message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Bildirim gönderildi", "count": len(tokens)})
}

// Settings Handler
type SettingsHandler struct {
	adminService *service.AdminService
}

func NewSettingsHandler(adminService *service.AdminService) *SettingsHandler {
	return &SettingsHandler{adminService: adminService}
}

func (h *SettingsHandler) GetAll(c *gin.Context) {
	settings, err := h.adminService.GetSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (h *SettingsHandler) Update(c *gin.Context) {
	var req models.SettingsUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.adminService.UpdateSettings(c.Request.Context(), req.Settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ayarlar güncellendi"})
}

// Report Handler
type ReportHandler struct {
	tripService     *service.TripService
	locationService *service.LocationService
	surveyService   *service.SurveyService
}

func NewReportHandler(tripService *service.TripService, locationService *service.LocationService, surveyService *service.SurveyService) *ReportHandler {
	return &ReportHandler{
		tripService:     tripService,
		locationService: locationService,
		surveyService:   surveyService,
	}
}

func (h *ReportHandler) GetRouteAnalysis(c *gin.Context) {
	startDate := time.Now().AddDate(0, -1, 0) // Son 1 ay
	endDate := time.Now()

	if startStr := c.Query("start_date"); startStr != "" {
		if s, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = s
		}
	}
	if endStr := c.Query("end_date"); endStr != "" {
		if e, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = e
		}
	}

	analysis, err := h.tripService.GetRouteAnalysis(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"routes": analysis})
}

func (h *ReportHandler) GetStopAnalysis(c *gin.Context) {
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	if startStr := c.Query("start_date"); startStr != "" {
		if s, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = s
		}
	}
	if endStr := c.Query("end_date"); endStr != "" {
		if e, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = e
		}
	}

	analysis, err := h.tripService.GetStopAnalysis(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stops": analysis})
}

func (h *ReportHandler) GetSurveyAnalysis(c *gin.Context) {
	responseRate, err := h.surveyService.GetResponseRate(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response_rate": responseRate,
	})
}
