package api

import (
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DriverHomeHandler struct {
	homeRepo   *repository.DriverHomeRepository
	driverRepo *repository.DriverRepository
	stopRepo   *repository.StopRepository
}

func NewDriverHomeHandler(
	homeRepo *repository.DriverHomeRepository,
	driverRepo *repository.DriverRepository,
) *DriverHomeHandler {
	return &DriverHomeHandler{
		homeRepo:   homeRepo,
		driverRepo: driverRepo,
	}
}

// SetStopRepository sets the stop repository (optional, for SetHomeFromStop feature)
func (h *DriverHomeHandler) SetStopRepository(stopRepo *repository.StopRepository) {
	h.stopRepo = stopRepo
}

// GetMyHomes returns home locations for the authenticated driver
// This is used by the mobile app to sync home locations for trip detection
func (h *DriverHomeHandler) GetMyHomes(c *gin.Context) {
	ctx := c.Request.Context()

	// Get driver ID from context (set by auth middleware)
	driverIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı bilgisi bulunamadı"})
		return
	}

	driverID, ok := driverIDValue.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kullanıcı ID formatı hatalı"})
		return
	}

	// Get active homes only
	homes, err := h.homeRepo.GetActiveByDriver(ctx, driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresleri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"homes":     homes,
		"max_homes": 2,
		"count":     len(homes),
	})
}

// GetDriverHomes returns all home locations for a driver (admin use)
func (h *DriverHomeHandler) GetDriverHomes(c *gin.Context) {
	ctx := c.Request.Context()
	driverID := c.Param("id")

	id, err := uuid.Parse(driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	homes, err := h.homeRepo.GetByDriver(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresleri alınamadı"})
		return
	}

	// Get driver info
	driver, _ := h.driverRepo.GetByID(ctx, id)
	driverName := ""
	if driver != nil {
		driverName = driver.Name + " " + driver.Surname
	}

	c.JSON(http.StatusOK, gin.H{
		"driver_id":   driverID,
		"driver_name": driverName,
		"homes":       homes,
		"max_homes":   2,
		"can_add":     len(homes) < 2,
	})
}

// CreateDriverHome creates a new home location for a driver
func (h *DriverHomeHandler) CreateDriverHome(c *gin.Context) {
	ctx := c.Request.Context()
	driverID := c.Param("id")

	id, err := uuid.Parse(driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	// Verify driver exists
	driver, err := h.driverRepo.GetByID(ctx, id)
	if err != nil || driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	var req struct {
		Name      string   `json:"name" binding:"required"`
		Latitude  float64  `json:"latitude" binding:"required"`
		Longitude float64  `json:"longitude" binding:"required"`
		Address   *string  `json:"address"`
		Province  *string  `json:"province"`
		District  *string  `json:"district"`
		Radius    *float64 `json:"radius"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	home := &models.DriverHome{
		DriverID:  id,
		Name:      req.Name,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Address:   req.Address,
		Province:  req.Province,
		District:  req.District,
		IsActive:  true,
	}

	if req.Radius != nil && *req.Radius > 0 {
		home.Radius = *req.Radius
	} else {
		home.Radius = 200 // Default 200 meters
	}

	err = h.homeRepo.Create(ctx, home)
	if err != nil {
		if err.Error() == "driver already has maximum number of home locations (2)" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Şoför maksimum 2 ev adresi ekleyebilir"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresi eklenemedi"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Ev adresi eklendi",
		"home":    home,
	})
}

// UpdateDriverHome updates a driver home location
func (h *DriverHomeHandler) UpdateDriverHome(c *gin.Context) {
	ctx := c.Request.Context()
	homeID := c.Param("id")

	id, err := uuid.Parse(homeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ev ID"})
		return
	}

	home, err := h.homeRepo.GetByID(ctx, id)
	if err != nil || home == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ev adresi bulunamadı"})
		return
	}

	var req struct {
		Name      *string  `json:"name"`
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
		Address   *string  `json:"address"`
		Province  *string  `json:"province"`
		District  *string  `json:"district"`
		Radius    *float64 `json:"radius"`
		IsActive  *bool    `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	if req.Name != nil {
		home.Name = *req.Name
	}
	if req.Latitude != nil {
		home.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		home.Longitude = *req.Longitude
	}
	if req.Address != nil {
		home.Address = req.Address
	}
	if req.Province != nil {
		home.Province = req.Province
	}
	if req.District != nil {
		home.District = req.District
	}
	if req.Radius != nil && *req.Radius > 0 {
		home.Radius = *req.Radius
	}
	if req.IsActive != nil {
		home.IsActive = *req.IsActive
	}

	err = h.homeRepo.Update(ctx, home)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresi güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Ev adresi güncellendi",
		"home":    home,
	})
}

// DeleteDriverHome deletes a driver home location
func (h *DriverHomeHandler) DeleteDriverHome(c *gin.Context) {
	ctx := c.Request.Context()
	homeID := c.Param("id")

	id, err := uuid.Parse(homeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ev ID"})
		return
	}

	// Verify home exists
	home, err := h.homeRepo.GetByID(ctx, id)
	if err != nil || home == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ev adresi bulunamadı"})
		return
	}

	err = h.homeRepo.Delete(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresi silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Ev adresi silindi",
	})
}

// GetAllDriverHomes returns all driver homes (admin)
func (h *DriverHomeHandler) GetAllDriverHomes(c *gin.Context) {
	ctx := c.Request.Context()

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	homes, total, err := h.homeRepo.GetAllHomes(ctx, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresleri alınamadı"})
		return
	}

	// Enrich with driver info
	enrichedHomes := make([]map[string]interface{}, len(homes))
	for i, home := range homes {
		driver, _ := h.driverRepo.GetByID(ctx, home.DriverID)
		driverName := ""
		if driver != nil {
			driverName = driver.Name + " " + driver.Surname
		}

		enrichedHomes[i] = map[string]interface{}{
			"id":          home.ID,
			"driver_id":   home.DriverID,
			"driver_name": driverName,
			"name":        home.Name,
			"latitude":    home.Latitude,
			"longitude":   home.Longitude,
			"address":     home.Address,
			"province":    home.Province,
			"district":    home.District,
			"radius":      home.Radius,
			"is_active":   home.IsActive,
			"created_at":  home.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"homes":  enrichedHomes,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// SetHomeFromStop creates a home from an existing stop (convenience function)
func (h *DriverHomeHandler) SetHomeFromStop(c *gin.Context) {
	ctx := c.Request.Context()

	var req struct {
		StopID string  `json:"stop_id" binding:"required"`
		Name   string  `json:"name" binding:"required"`
		Radius float64 `json:"radius"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	stopID, err := uuid.Parse(req.StopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz durak ID"})
		return
	}

	// Check if stop repository is available
	if h.stopRepo == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Bu özellik şu anda kullanılamıyor"})
		return
	}

	// Get the stop
	stop, err := h.stopRepo.GetByID(ctx, stopID)
	if err != nil || stop == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Durak bulunamadı"})
		return
	}

	// Check if driver exists
	driver, err := h.driverRepo.GetByID(ctx, stop.DriverID)
	if err != nil || driver == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şoför bulunamadı"})
		return
	}

	// Set default radius
	radius := 200.0
	if req.Radius > 0 {
		radius = req.Radius
	}

	// Create home from stop location
	home := &models.DriverHome{
		DriverID:  stop.DriverID,
		Name:      req.Name,
		Latitude:  stop.Latitude,
		Longitude: stop.Longitude,
		Address:   stop.Address,
		Province:  stop.Province,
		District:  stop.District,
		Radius:    radius,
		IsActive:  true,
	}

	err = h.homeRepo.Create(ctx, home)
	if err != nil {
		if err.Error() == "driver already has maximum number of home locations (2)" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Şoför maksimum 2 ev adresi ekleyebilir"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ev adresi oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Duraktan ev adresi oluşturuldu",
		"home":    home,
		"stop_id": stopID,
	})
}
