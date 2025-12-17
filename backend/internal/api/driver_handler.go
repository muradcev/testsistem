package api

import (
	"log"
	"net/http"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
)

type DriverHandler struct {
	driverService *service.DriverService
}

func NewDriverHandler(driverService *service.DriverService) *DriverHandler {
	return &DriverHandler{driverService: driverService}
}

func (h *DriverHandler) GetProfile(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	driver, err := h.driverService.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, driver)
}

func (h *DriverHandler) UpdateProfile(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.DriverUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driver, err := h.driverService.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	if req.Name != "" {
		driver.Name = req.Name
	}
	if req.Surname != "" {
		driver.Surname = req.Surname
	}
	if req.Province != "" {
		driver.Province = req.Province
	}
	if req.District != "" {
		driver.District = req.District
	}
	if req.Neighborhood != "" {
		driver.Neighborhood = req.Neighborhood
	}
	if req.HomeLatitude != nil {
		driver.HomeLatitude = req.HomeLatitude
	}
	if req.HomeLongitude != nil {
		driver.HomeLongitude = req.HomeLongitude
	}

	if err := h.driverService.Update(c.Request.Context(), driver); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, driver)
}

func (h *DriverHandler) UpdateFCMToken(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		log.Printf("[FCM] UpdateFCMToken - Yetkisiz erişim")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[FCM] UpdateFCMToken - JSON parse hatası: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[FCM] UpdateFCMToken - Driver: %s, Token: %s...", userID, req.Token[:min(30, len(req.Token))])

	if err := h.driverService.UpdateFCMToken(c.Request.Context(), userID, req.Token); err != nil {
		log.Printf("[FCM] UpdateFCMToken - DB hatası: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[FCM] UpdateFCMToken - BAŞARILI: %s", userID)
	c.JSON(http.StatusOK, gin.H{"message": "Token güncellendi"})
}

// UpdateDeviceInfo - Cihaz ve uygulama bilgilerini günceller
func (h *DriverHandler) UpdateDeviceInfo(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.DeviceInfoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.driverService.UpdateDeviceInfo(c.Request.Context(), userID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cihaz bilgileri güncellendi"})
}

// Heartbeat - Uygulama aktif olduğunu bildirir
func (h *DriverHandler) Heartbeat(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	if err := h.driverService.UpdateLastActive(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "OK"})
}

// SyncCallLogs - Arama geçmişini senkronize et
func (h *DriverHandler) SyncCallLogs(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.CallLogSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if call_log is enabled for this driver
	driver, err := h.driverService.GetByID(c.Request.Context(), userID)
	if err != nil || driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	if !driver.CallLogEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Arama geçmişi özelliği kapalı"})
		return
	}

	count, err := h.driverService.SyncCallLogs(c.Request.Context(), userID, req.Calls)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Arama geçmişi senkronize edildi",
		"synced":    count,
		"submitted": len(req.Calls),
	})
}

// SyncContacts - Rehberi senkronize et
func (h *DriverHandler) SyncContacts(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.ContactSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if contacts is enabled for this driver
	driver, err := h.driverService.GetByID(c.Request.Context(), userID)
	if err != nil || driver == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	if !driver.ContactsEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Rehber özelliği kapalı"})
		return
	}

	count, err := h.driverService.SyncContacts(c.Request.Context(), userID, req.Contacts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Rehber senkronize edildi",
		"synced":    count,
		"submitted": len(req.Contacts),
	})
}
