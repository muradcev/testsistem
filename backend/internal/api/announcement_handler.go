package api

import (
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AnnouncementHandler struct {
	announcementRepo *repository.AnnouncementRepository
	driverRepo       *repository.DriverRepository
	auditRepo        *repository.AuditRepository
}

func NewAnnouncementHandler(announcementRepo *repository.AnnouncementRepository, driverRepo *repository.DriverRepository, auditRepo *repository.AuditRepository) *AnnouncementHandler {
	return &AnnouncementHandler{
		announcementRepo: announcementRepo,
		driverRepo:       driverRepo,
		auditRepo:        auditRepo,
	}
}

// ==================== ADMIN ENDPOINTS ====================

// CreateAnnouncement - Yeni duyuru oluştur (Admin)
// @Summary Yeni duyuru oluştur
// @Tags Admin - Announcements
// @Accept json
// @Produce json
// @Param request body models.AnnouncementCreateRequest true "Duyuru bilgileri"
// @Success 201 {object} models.Announcement
// @Router /admin/announcements [post]
func (h *AnnouncementHandler) CreateAnnouncement(c *gin.Context) {
	var req models.AnnouncementCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek: " + err.Error()})
		return
	}

	// Validate type
	validTypes := map[string]bool{"info": true, "warning": true, "success": true, "promotion": true}
	if !validTypes[req.Type] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz duyuru tipi. Geçerli tipler: info, warning, success, promotion"})
		return
	}

	// Validate target_type
	validTargets := map[string]bool{"all": true, "province": true, "specific_drivers": true}
	if !validTargets[req.TargetType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz hedef tipi. Geçerli tipler: all, province, specific_drivers"})
		return
	}

	// Admin ID
	adminIDStr, _ := c.Get("user_id")
	adminID, _ := uuid.Parse(adminIDStr.(string))

	announcement, err := h.announcementRepo.Create(c.Request.Context(), &req, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyuru oluşturulamadı: " + err.Error()})
		return
	}

	// Audit log
	if h.auditRepo != nil {
		h.auditRepo.LogAction(c.Request.Context(), &adminID, "admin", "", "create", "announcement", &announcement.ID, map[string]interface{}{
			"title": req.Title,
			"type":  req.Type,
		}, c.ClientIP(), c.GetHeader("User-Agent"))
	}

	c.JSON(http.StatusCreated, announcement)
}

// GetAnnouncements - Tüm duyuruları listele (Admin)
// @Summary Duyuruları listele
// @Tags Admin - Announcements
// @Produce json
// @Param limit query int false "Limit" default(20)
// @Param offset query int false "Offset" default(0)
// @Param is_active query bool false "Aktif mi?"
// @Param type query string false "Duyuru tipi"
// @Success 200 {object} map[string]interface{}
// @Router /admin/announcements [get]
func (h *AnnouncementHandler) GetAnnouncements(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	announcementType := c.Query("type")

	var isActive *bool
	if c.Query("is_active") != "" {
		active := c.Query("is_active") == "true"
		isActive = &active
	}

	announcements, total, err := h.announcementRepo.GetAll(c.Request.Context(), limit, offset, isActive, announcementType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyurular alınamadı: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"announcements": announcements,
		"total":         total,
		"limit":         limit,
		"offset":        offset,
	})
}

// GetAnnouncementByID - Duyuru detayı (Admin)
// @Summary Duyuru detayı
// @Tags Admin - Announcements
// @Produce json
// @Param id path string true "Duyuru ID"
// @Success 200 {object} models.Announcement
// @Router /admin/announcements/{id} [get]
func (h *AnnouncementHandler) GetAnnouncementByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	announcement, err := h.announcementRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Duyuru bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, announcement)
}

// UpdateAnnouncement - Duyuru güncelle (Admin)
// @Summary Duyuru güncelle
// @Tags Admin - Announcements
// @Accept json
// @Produce json
// @Param id path string true "Duyuru ID"
// @Param request body models.AnnouncementUpdateRequest true "Güncellenecek alanlar"
// @Success 200 {object} models.Announcement
// @Router /admin/announcements/{id} [put]
func (h *AnnouncementHandler) UpdateAnnouncement(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var req models.AnnouncementUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek: " + err.Error()})
		return
	}

	// Validate type if provided
	if req.Type != nil {
		validTypes := map[string]bool{"info": true, "warning": true, "success": true, "promotion": true}
		if !validTypes[*req.Type] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz duyuru tipi"})
			return
		}
	}

	// Validate target_type if provided
	if req.TargetType != nil {
		validTargets := map[string]bool{"all": true, "province": true, "specific_drivers": true}
		if !validTargets[*req.TargetType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz hedef tipi"})
			return
		}
	}

	announcement, err := h.announcementRepo.Update(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyuru güncellenemedi: " + err.Error()})
		return
	}

	// Audit log
	if h.auditRepo != nil {
		adminIDStr, _ := c.Get("user_id")
		adminID, _ := uuid.Parse(adminIDStr.(string))
		h.auditRepo.LogAction(c.Request.Context(), &adminID, "admin", "", "update", "announcement", &id, req, c.ClientIP(), c.GetHeader("User-Agent"))
	}

	c.JSON(http.StatusOK, announcement)
}

// DeleteAnnouncement - Duyuru sil (Admin)
// @Summary Duyuru sil
// @Tags Admin - Announcements
// @Param id path string true "Duyuru ID"
// @Success 200 {object} map[string]string
// @Router /admin/announcements/{id} [delete]
func (h *AnnouncementHandler) DeleteAnnouncement(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	if err := h.announcementRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyuru silinemedi: " + err.Error()})
		return
	}

	// Audit log
	if h.auditRepo != nil {
		adminIDStr, _ := c.Get("user_id")
		adminID, _ := uuid.Parse(adminIDStr.(string))
		h.auditRepo.LogAction(c.Request.Context(), &adminID, "admin", "", "delete", "announcement", &id, nil, c.ClientIP(), c.GetHeader("User-Agent"))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Duyuru silindi"})
}

// GetAnnouncementStats - Duyuru istatistikleri (Admin)
// @Summary Duyuru istatistikleri
// @Tags Admin - Announcements
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /admin/announcements/stats [get]
func (h *AnnouncementHandler) GetAnnouncementStats(c *gin.Context) {
	stats, err := h.announcementRepo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "İstatistikler alınamadı: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// ToggleAnnouncementActive - Duyuru aktif/pasif toggle (Admin)
// @Summary Duyuru aktif/pasif toggle
// @Tags Admin - Announcements
// @Param id path string true "Duyuru ID"
// @Success 200 {object} models.Announcement
// @Router /admin/announcements/{id}/toggle [post]
func (h *AnnouncementHandler) ToggleAnnouncementActive(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	announcement, err := h.announcementRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Duyuru bulunamadı"})
		return
	}

	newActive := !announcement.IsActive
	req := &models.AnnouncementUpdateRequest{IsActive: &newActive}

	updated, err := h.announcementRepo.Update(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyuru güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// ==================== DRIVER ENDPOINTS ====================

// GetActiveAnnouncements - Şoför için aktif duyuruları getir
// @Summary Aktif duyuruları getir (Şoför)
// @Tags Driver - Announcements
// @Produce json
// @Success 200 {array} models.AnnouncementResponse
// @Router /driver/announcements [get]
func (h *AnnouncementHandler) GetActiveAnnouncements(c *gin.Context) {
	driverIDStr, _ := c.Get("user_id")
	driverID, _ := uuid.Parse(driverIDStr.(string))

	// Şoförün ilini al
	driver, err := h.driverRepo.GetByID(c.Request.Context(), driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoför bilgisi alınamadı"})
		return
	}

	province := driver.Province

	announcements, err := h.announcementRepo.GetActiveForDriver(c.Request.Context(), driverID, province)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyurular alınamadı: " + err.Error()})
		return
	}

	if announcements == nil {
		announcements = []models.AnnouncementResponse{}
	}

	c.JSON(http.StatusOK, gin.H{"announcements": announcements})
}

// DismissAnnouncement - Şoför duyuruyu kapatır
// @Summary Duyuruyu kapat (Şoför)
// @Tags Driver - Announcements
// @Param id path string true "Duyuru ID"
// @Success 200 {object} map[string]string
// @Router /driver/announcements/{id}/dismiss [post]
func (h *AnnouncementHandler) DismissAnnouncement(c *gin.Context) {
	announcementID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	driverIDStr, _ := c.Get("user_id")
	driverID, _ := uuid.Parse(driverIDStr.(string))

	// Duyurunun kapatılabilir olduğunu kontrol et
	announcement, err := h.announcementRepo.GetByID(c.Request.Context(), announcementID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Duyuru bulunamadı"})
		return
	}

	if !announcement.IsDismissable {
		c.JSON(http.StatusForbidden, gin.H{"error": "Bu duyuru kapatılamaz"})
		return
	}

	if err := h.announcementRepo.DismissAnnouncement(c.Request.Context(), announcementID, driverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Duyuru kapatılamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Duyuru kapatıldı"})
}
