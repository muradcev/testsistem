package api

import (
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	repo *repository.AuditRepository
}

func NewAuditHandler(repo *repository.AuditRepository) *AuditHandler {
	return &AuditHandler{repo: repo}
}

// GetAuditLogs - Tüm audit logları getir
func (h *AuditHandler) GetAuditLogs(c *gin.Context) {
	limit := 50
	offset := 0

	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Filters
	filters := make(map[string]string)
	if userType := c.Query("user_type"); userType != "" {
		filters["user_type"] = userType
	}
	if action := c.Query("action"); action != "" {
		filters["action"] = action
	}
	if resourceType := c.Query("resource_type"); resourceType != "" {
		filters["resource_type"] = resourceType
	}

	logs, total, err := h.repo.GetAll(c.Request.Context(), limit, offset, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Audit logları alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetAuditStats - Audit log istatistikleri
func (h *AuditHandler) GetAuditStats(c *gin.Context) {
	stats, err := h.repo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "İstatistikler alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// CleanupOldLogs - Eski logları temizle
func (h *AuditHandler) CleanupOldLogs(c *gin.Context) {
	days := 90 // Default 90 gün

	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			days = parsed
		}
	}

	deleted, err := h.repo.DeleteOldLogs(c.Request.Context(), days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Temizlik başarısız"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"deleted": deleted,
		"message": "Eski loglar temizlendi",
	})
}
