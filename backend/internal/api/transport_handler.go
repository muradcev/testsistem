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

type TransportHandler struct {
	transportService *service.TransportService
}

func NewTransportHandler(transportService *service.TransportService) *TransportHandler {
	return &TransportHandler{transportService: transportService}
}

// Create - Yeni taşıma kaydı oluştur
// POST /admin/transport-records
func (h *TransportHandler) Create(c *gin.Context) {
	var req models.CreateTransportRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.transportService.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"record": record})
}

// GetAll - Tüm taşıma kayıtlarını getir
// GET /admin/transport-records
func (h *TransportHandler) GetAll(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	filters := make(map[string]interface{})

	// Driver ID filtresi
	if driverIDStr := c.Query("driver_id"); driverIDStr != "" {
		if driverID, err := uuid.Parse(driverIDStr); err == nil {
			filters["driver_id"] = driverID
		}
	}

	// İl filtreleri
	if origin := c.Query("origin_province"); origin != "" {
		filters["origin_province"] = origin
	}
	if dest := c.Query("destination_province"); dest != "" {
		filters["destination_province"] = dest
	}

	// Dorse tipi filtresi
	if trailerType := c.Query("trailer_type"); trailerType != "" {
		filters["trailer_type"] = trailerType
	}

	// Tarih filtreleri
	if startDateStr := c.Query("start_date"); startDateStr != "" {
		if startDate, err := time.Parse("2006-01-02", startDateStr); err == nil {
			filters["start_date"] = startDate
		}
	}
	if endDateStr := c.Query("end_date"); endDateStr != "" {
		if endDate, err := time.Parse("2006-01-02", endDateStr); err == nil {
			filters["end_date"] = endDate
		}
	}

	records, total, err := h.transportService.GetAll(c.Request.Context(), limit, offset, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"records": records,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// GetByID - ID ile taşıma kaydı getir
// GET /admin/transport-records/:id
func (h *TransportHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	record, err := h.transportService.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if record == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kayıt bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// Update - Taşıma kaydı güncelle
// PUT /admin/transport-records/:id
func (h *TransportHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var req models.UpdateTransportRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.transportService.Update(c.Request.Context(), id, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kayıt güncellendi"})
}

// Delete - Taşıma kaydı sil
// DELETE /admin/transport-records/:id
func (h *TransportHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	if err := h.transportService.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kayıt silindi"})
}

// GetStats - İstatistikler
// GET /admin/transport-records/stats
func (h *TransportHandler) GetStats(c *gin.Context) {
	stats, err := h.transportService.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetTrailerTypes - Dorse tiplerini getir
// GET /admin/transport-records/trailer-types
func (h *TransportHandler) GetTrailerTypes(c *gin.Context) {
	types, err := h.transportService.GetTrailerTypes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"trailer_types": types})
}

// GetPricesByRoute - Güzergah bazında fiyatları getir
// GET /admin/transport-records/prices
func (h *TransportHandler) GetPricesByRoute(c *gin.Context) {
	origin := c.Query("origin")
	destination := c.Query("destination")

	if origin == "" || destination == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "origin ve destination gerekli"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	records, err := h.transportService.GetPricesByRoute(c.Request.Context(), origin, destination, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"records": records,
		"origin":  origin,
		"destination": destination,
	})
}
