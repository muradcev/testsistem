package api

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AppLogHandler struct {
	logRepo *repository.AppLogRepository
}

func NewAppLogHandler(logRepo *repository.AppLogRepository) *AppLogHandler {
	return &AppLogHandler{logRepo: logRepo}
}

// SaveBatchLogs - Toplu log kaydet (Driver endpoint)
func (h *AppLogHandler) SaveBatchLogs(c *gin.Context) {
	// Driver ID al (opsiyonel - token'dan)
	driverIDFromToken, hasDriverID := middleware.GetUserID(c)

	var req models.AppLogBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri: " + err.Error()})
		return
	}

	if len(req.Logs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir log gerekli"})
		return
	}

	// Log kayıtlarını dönüştür
	logs := make([]models.AppLog, 0, len(req.Logs))
	serverTime := time.Now()

	for _, entry := range req.Logs {
		logID := uuid.New()
		if entry.ID != "" {
			if parsed, err := uuid.Parse(entry.ID); err == nil {
				logID = parsed
			}
		}

		clientTime, _ := time.Parse(time.RFC3339, entry.Timestamp)
		if clientTime.IsZero() {
			clientTime = serverTime
		}

		var driverUUID *uuid.UUID
		if hasDriverID && driverIDFromToken != uuid.Nil {
			driverUUID = &driverIDFromToken
		}

		appLog := models.AppLog{
			ID:          logID,
			DriverID:    driverUUID,
			Level:       models.LogLevel(entry.Level),
			Category:    models.LogCategory(entry.Category),
			Message:     entry.Message,
			StackTrace:  entry.StackTrace,
			Metadata:    entry.Metadata,
			Screen:      entry.Screen,
			Action:      entry.Action,
			DeviceID:    strPtr(req.DeviceID),
			DeviceModel: strPtr(req.DeviceModel),
			OSVersion:   strPtr(req.OSVersion),
			AppVersion:  strPtr(req.AppVersion),
			BuildNumber: strPtr(req.BuildNumber),
			ClientTime:  clientTime,
			ServerTime:  serverTime,
		}

		logs = append(logs, appLog)
	}

	// Kaydet
	if err := h.logRepo.SaveBatch(c.Request.Context(), logs); err != nil {
		log.Printf("[AppLog] Batch save error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Log kaydetme hatası"})
		return
	}

	log.Printf("[AppLog] Saved %d logs from driver %s (device: %s)", len(logs), driverIDFromToken.String(), req.DeviceID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(logs),
	})
}

// GetLogs - Log listesi (Admin endpoint)
func (h *AppLogHandler) GetLogs(c *gin.Context) {
	filter := models.AppLogFilter{
		Limit:  100,
		Offset: 0,
	}

	// Query params
	if limit := c.Query("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil {
			filter.Limit = l
		}
	}
	if offset := c.Query("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil {
			filter.Offset = o
		}
	}
	if level := c.Query("level"); level != "" {
		lvl := models.LogLevel(level)
		filter.Level = &lvl
	}
	if category := c.Query("category"); category != "" {
		cat := models.LogCategory(category)
		filter.Category = &cat
	}
	if driverID := c.Query("driver_id"); driverID != "" {
		if parsed, err := uuid.Parse(driverID); err == nil {
			filter.DriverID = &parsed
		}
	}
	if search := c.Query("search"); search != "" {
		filter.Search = &search
	}
	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			filter.StartTime = &t
		}
	}
	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			filter.EndTime = &t
		}
	}

	logs, total, err := h.logRepo.GetByFilter(c.Request.Context(), filter)
	if err != nil {
		log.Printf("[AppLog] GetLogs error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Log getirme hatası"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"total":  total,
		"limit":  filter.Limit,
		"offset": filter.Offset,
	})
}

// GetLogStats - Log istatistikleri (Admin endpoint)
func (h *AppLogHandler) GetLogStats(c *gin.Context) {
	var driverID *uuid.UUID
	if did := c.Query("driver_id"); did != "" {
		if parsed, err := uuid.Parse(did); err == nil {
			driverID = &parsed
		}
	}

	stats, err := h.logRepo.GetStats(c.Request.Context(), driverID)
	if err != nil {
		log.Printf("[AppLog] GetStats error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "İstatistik getirme hatası"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetDriverLogs - Belirli şoförün logları (Admin endpoint)
func (h *AppLogHandler) GetDriverLogs(c *gin.Context) {
	driverIDStr := c.Param("id")
	driverID, err := uuid.Parse(driverIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	limit := 100
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	logs, total, err := h.logRepo.GetByDriverID(c.Request.Context(), driverID, limit, offset)
	if err != nil {
		log.Printf("[AppLog] GetDriverLogs error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Log getirme hatası"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetErrors - Hata logları (Admin endpoint)
func (h *AppLogHandler) GetErrors(c *gin.Context) {
	limit := 100
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	logs, total, err := h.logRepo.GetErrors(c.Request.Context(), limit, offset)
	if err != nil {
		log.Printf("[AppLog] GetErrors error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hata getirme hatası"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetCritical - Kritik loglar (Admin endpoint)
func (h *AppLogHandler) GetCritical(c *gin.Context) {
	limit := 100
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	logs, total, err := h.logRepo.GetCritical(c.Request.Context(), limit, offset)
	if err != nil {
		log.Printf("[AppLog] GetCritical error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kritik log getirme hatası"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// DeleteOldLogs - Eski logları sil (Admin endpoint)
func (h *AppLogHandler) DeleteOldLogs(c *gin.Context) {
	days := 30 // Default 30 gün
	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil {
			days = parsed
		}
	}

	olderThan := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	deleted, err := h.logRepo.DeleteOld(c.Request.Context(), olderThan)
	if err != nil {
		log.Printf("[AppLog] DeleteOldLogs error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Silme hatası"})
		return
	}

	log.Printf("[AppLog] Deleted %d logs older than %d days", deleted, days)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"deleted": deleted,
		"days":    days,
	})
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
