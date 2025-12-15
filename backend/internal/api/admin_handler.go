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

// GetWeeklyStats returns trip statistics for the last 7 days
func (h *AdminHandler) GetWeeklyStats(c *gin.Context) {
	ctx := c.Request.Context()

	weeklyStats, err := h.tripService.GetWeeklyStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"weekly_stats": weeklyStats,
	})
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
		ContactsEnabled:           driver.ContactsEnabled,
		CallLogEnabled:            driver.CallLogEnabled,
		SurveysEnabled:            driver.SurveysEnabled,
		QuestionsEnabled:          driver.QuestionsEnabled,
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

// UpdateDriverStatus - Sürücü durumunu güncelle (aktif/pasif)
func (h *AdminHandler) UpdateDriverStatus(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	if err := h.driverService.UpdateStatus(ctx, driverID, req.IsActive); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sürücü durumu güncellendi", "is_active": req.IsActive})
}

// UpdateDriverFeatures - Sürücü özelliklerini güncelle
func (h *AdminHandler) UpdateDriverFeatures(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	var req struct {
		LocationTrackingEnabled   *bool `json:"location_tracking_enabled"`
		BackgroundLocationEnabled *bool `json:"background_location_enabled"`
		NotificationsEnabled      *bool `json:"notifications_enabled"`
		SurveysEnabled            *bool `json:"surveys_enabled"`
		QuestionsEnabled          *bool `json:"questions_enabled"`
		ContactsEnabled           *bool `json:"contacts_enabled"`
		CallLogEnabled            *bool `json:"call_log_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	features := make(map[string]bool)

	if req.LocationTrackingEnabled != nil {
		features["location_tracking_enabled"] = *req.LocationTrackingEnabled
	}
	if req.BackgroundLocationEnabled != nil {
		features["background_location_enabled"] = *req.BackgroundLocationEnabled
	}
	if req.NotificationsEnabled != nil {
		features["notifications_enabled"] = *req.NotificationsEnabled
	}
	if req.SurveysEnabled != nil {
		features["surveys_enabled"] = *req.SurveysEnabled
	}
	if req.QuestionsEnabled != nil {
		features["questions_enabled"] = *req.QuestionsEnabled
	}
	if req.ContactsEnabled != nil {
		features["contacts_enabled"] = *req.ContactsEnabled
	}
	if req.CallLogEnabled != nil {
		features["call_log_enabled"] = *req.CallLogEnabled
	}

	if err := h.driverService.UpdateFeatures(ctx, driverID, features); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sürücü özellikleri güncellendi", "features": features})
}

// DeleteDriver - Sürücü sil
func (h *AdminHandler) DeleteDriver(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	ctx := c.Request.Context()

	// Önce sürücünün var olup olmadığını kontrol et
	driver, err := h.driverService.GetByID(ctx, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	// Sürücüyü sil (cascade ile ilişkili veriler de silinecek)
	if err := h.driverService.Delete(ctx, driverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sürücü ve ilişkili tüm veriler silindi", "driver_id": driverID})
}

// ==================== DRIVER CALL LOGS ====================

// GetDriverCallLogs - Sürücünün arama geçmişini getir
func (h *AdminHandler) GetDriverCallLogs(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	ctx := c.Request.Context()
	logs, total, err := h.driverService.GetDriverCallLogs(ctx, driverID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// İstatistikleri de getir
	stats, _ := h.driverService.GetCallLogStats(ctx, driverID)

	c.JSON(http.StatusOK, gin.H{
		"call_logs": logs,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
		"stats":     stats,
	})
}

// DeleteDriverCallLogs - Sürücünün tüm arama geçmişini sil
func (h *AdminHandler) DeleteDriverCallLogs(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	ctx := c.Request.Context()
	count, err := h.driverService.DeleteDriverCallLogs(ctx, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Arama geçmişi silindi",
		"deleted_count": count,
	})
}

// ==================== DRIVER CONTACTS ====================

// GetDriverContacts - Sürücünün rehberini getir
func (h *AdminHandler) GetDriverContacts(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	ctx := c.Request.Context()
	contacts, total, err := h.driverService.GetDriverContacts(ctx, driverID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// İstatistikleri de getir
	stats, _ := h.driverService.GetContactStats(ctx, driverID)

	c.JSON(http.StatusOK, gin.H{
		"contacts": contacts,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"stats":    stats,
	})
}

// DeleteDriverContacts - Sürücünün tüm rehberini sil
func (h *AdminHandler) DeleteDriverContacts(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	ctx := c.Request.Context()
	count, err := h.driverService.DeleteDriverContacts(ctx, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Rehber silindi",
		"deleted_count": count,
	})
}

// ==================== ALL CALL LOGS & CONTACTS ====================

// GetAllCallLogs - Tüm şoförlerin arama geçmişini getir
func (h *AdminHandler) GetAllCallLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	callType := c.Query("call_type")

	var driverID *uuid.UUID
	if driverIDStr := c.Query("driver_id"); driverIDStr != "" {
		if parsed, err := uuid.Parse(driverIDStr); err == nil {
			driverID = &parsed
		}
	}

	ctx := c.Request.Context()
	logs, total, err := h.driverService.GetAllCallLogs(ctx, limit, offset, driverID, callType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	stats, _ := h.driverService.GetAllCallLogsStats(ctx)

	c.JSON(http.StatusOK, gin.H{
		"call_logs": logs,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
		"stats":     stats,
	})
}

// GetAllContacts - Tüm şoförlerin rehberini getir
func (h *AdminHandler) GetAllContacts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")

	var driverID *uuid.UUID
	if driverIDStr := c.Query("driver_id"); driverIDStr != "" {
		if parsed, err := uuid.Parse(driverIDStr); err == nil {
			driverID = &parsed
		}
	}

	ctx := c.Request.Context()
	contacts, total, err := h.driverService.GetAllContacts(ctx, limit, offset, driverID, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	stats, _ := h.driverService.GetAllContactsStats(ctx)

	c.JSON(http.StatusOK, gin.H{
		"contacts": contacts,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"stats":    stats,
	})
}

// ==================== DRIVER RESPONSES ====================

// GetDriverResponses - Sürücünün anket ve soru cevaplarını getir
func (h *AdminHandler) GetDriverResponses(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	ctx := c.Request.Context()

	surveyResponses, err := h.driverService.GetDriverSurveyResponses(ctx, driverID, limit)
	if err != nil {
		surveyResponses = []models.DriverSurveyResponse{}
	}

	questionResponses, err := h.driverService.GetDriverQuestionResponses(ctx, driverID, limit)
	if err != nil {
		questionResponses = []models.DriverQuestionResponse{}
	}

	c.JSON(http.StatusOK, gin.H{
		"survey_responses":   surveyResponses,
		"question_responses": questionResponses,
	})
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

// ValidateAppInstallations - Tüm şoförlerin uygulama kurulum durumunu FCM ile doğrula
// Görünmez bir push göndererek uygulamanın hala kurulu olup olmadığını kontrol eder
func (h *NotificationHandler) ValidateAppInstallations(c *gin.Context) {
	ctx := c.Request.Context()

	// FCM token'ı olan tüm şoförleri al
	drivers, err := h.driverService.GetDriversWithFCMToken(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(drivers) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message":     "Kontrol edilecek şoför yok",
			"total":       0,
			"valid":       0,
			"uninstalled": 0,
			"results":     []interface{}{},
		})
		return
	}

	// Token -> Driver ID mapping
	tokenToDriver := make(map[string]uuid.UUID)
	var tokens []string
	for _, d := range drivers {
		if d.FCMToken != nil && *d.FCMToken != "" {
			tokenToDriver[*d.FCMToken] = d.ID
			tokens = append(tokens, *d.FCMToken)
		}
	}

	// FCM ile token'ları doğrula
	results, err := h.notificationService.ValidateTokens(ctx, tokens)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "FCM validation failed: " + err.Error()})
		return
	}

	// Sonuçları işle
	var validCount, uninstalledCount int
	type driverResult struct {
		DriverID    uuid.UUID `json:"driver_id"`
		DriverName  string    `json:"driver_name"`
		Phone       string    `json:"phone"`
		Valid       bool      `json:"valid"`
		Uninstalled bool      `json:"uninstalled"`
		Error       string    `json:"error,omitempty"`
	}

	driverResults := make([]driverResult, 0, len(results))

	for _, result := range results {
		driverID := tokenToDriver[result.Token]

		// Şoför bilgilerini bul
		var driverName, phone string
		for _, d := range drivers {
			if d.ID == driverID {
				driverName = d.Name + " " + d.Surname
				phone = d.Phone
				break
			}
		}

		dr := driverResult{
			DriverID:    driverID,
			DriverName:  driverName,
			Phone:       phone,
			Valid:       result.Valid,
			Uninstalled: result.Uninstalled,
			Error:       result.Error,
		}

		if result.Valid {
			validCount++
		}
		if result.Uninstalled {
			uninstalledCount++
			// Şoförün app_status'unu güncelle (opsiyonel)
			// h.driverService.MarkAppUninstalled(ctx, driverID)
		}

		driverResults = append(driverResults, dr)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Uygulama kontrolü tamamlandı",
		"total":       len(results),
		"valid":       validCount,
		"uninstalled": uninstalledCount,
		"results":     driverResults,
	})
}

// RequestDriverLocation - Şoförden anlık konum iste
func (h *NotificationHandler) RequestDriverLocation(c *gin.Context) {
	var req struct {
		DriverID uuid.UUID `json:"driver_id" binding:"required"`
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
	if driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}
	if driver.FCMToken == nil || *driver.FCMToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Şoförün FCM token'ı yok, uygulama kurulu olmayabilir"})
		return
	}

	// Benzersiz istek ID'si oluştur
	requestID := uuid.New().String()

	// Konum isteği gönder
	if err := h.notificationService.SendLocationRequest(c.Request.Context(), *driver.FCMToken, requestID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konum isteği gönderilemedi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Konum isteği gönderildi",
		"request_id": requestID,
		"driver_id":  req.DriverID,
		"driver":     driver.Name + " " + driver.Surname,
	})
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
