package api

import (
	"context"
	"encoding/json"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ConfigHandler struct {
	cargoRepo    *repository.CargoRepository
	settingsRepo *repository.SettingsRepository
}

func NewConfigHandler(cargoRepo *repository.CargoRepository, settingsRepo ...*repository.SettingsRepository) *ConfigHandler {
	handler := &ConfigHandler{cargoRepo: cargoRepo}
	if len(settingsRepo) > 0 {
		handler.settingsRepo = settingsRepo[0]
	}
	return handler
}

// GetAppConfig - Mobil uygulama için tüm konfigürasyonu döndür
func (h *ConfigHandler) GetAppConfig(c *gin.Context) {
	ctx := c.Request.Context()

	cargoTypes, err := h.cargoRepo.GetAllCargoTypes(ctx)
	if err != nil {
		cargoTypes = []models.CargoType{}
	}

	vehicleBrands, err := h.cargoRepo.GetVehicleBrandsWithModels(ctx)
	if err != nil {
		vehicleBrands = []models.VehicleBrand{}
	}

	trailerTypes, err := h.cargoRepo.GetAllTrailerTypes(ctx)
	if err != nil {
		trailerTypes = []models.TrailerTypeConfig{}
	}

	// Mobil konfigürasyonu yükle
	mobileConfig := h.loadMobileConfig(ctx)

	config := models.AppConfig{
		CargoTypes:    cargoTypes,
		VehicleBrands: vehicleBrands,
		TrailerTypes:  trailerTypes,
		MobileConfig:  mobileConfig,
	}

	c.JSON(http.StatusOK, config)
}

// loadMobileConfig - Mobil ayarları settings tablosundan yükle
func (h *ConfigHandler) loadMobileConfig(ctx context.Context) models.MobileConfig {
	// Varsayılan değerler
	mobileConfig := models.DefaultMobileConfig()

	if h.settingsRepo == nil {
		return mobileConfig
	}

	// Settings'den mobile_config anahtarını al
	setting, err := h.settingsRepo.Get(ctx, "mobile_config")
	if err != nil || setting == nil {
		return mobileConfig
	}

	// JSON'dan parse et
	var loadedConfig models.MobileConfig
	if err := json.Unmarshal([]byte(setting.Value), &loadedConfig); err != nil {
		return mobileConfig
	}

	return loadedConfig
}

// GetMobileConfig - Mobil konfigürasyonu döndür (admin için)
func (h *ConfigHandler) GetMobileConfig(c *gin.Context) {
	mobileConfig := h.loadMobileConfig(c.Request.Context())
	c.JSON(http.StatusOK, mobileConfig)
}

// UpdateMobileConfig - Mobil konfigürasyonu güncelle (admin için)
func (h *ConfigHandler) UpdateMobileConfig(c *gin.Context) {
	if h.settingsRepo == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings repository not available"})
		return
	}

	var req models.MobileConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri: " + err.Error()})
		return
	}

	// JSON'a dönüştür
	configJSON, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konfigürasyon dönüştürülemedi"})
		return
	}

	// Settings'e kaydet
	if err := h.settingsRepo.Set(c.Request.Context(), "mobile_config", string(configJSON)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konfigürasyon kaydedilemedi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Mobil konfigürasyon güncellendi",
		"mobile_config": req,
	})
}

// ============================================
// Cargo Types
// ============================================

func (h *ConfigHandler) GetCargoTypes(c *gin.Context) {
	ctx := c.Request.Context()

	types, err := h.cargoRepo.GetAllCargoTypes(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Yük tipleri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cargo_types": types})
}

func (h *ConfigHandler) CreateCargoType(c *gin.Context) {
	ctx := c.Request.Context()

	var req models.CargoType
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.IsActive = true
	if err := h.cargoRepo.CreateCargoType(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Yük tipi oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, req)
}

func (h *ConfigHandler) UpdateCargoType(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var req models.CargoType
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.ID = id
	if err := h.cargoRepo.UpdateCargoType(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Yük tipi güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, req)
}

func (h *ConfigHandler) DeleteCargoType(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if err := h.cargoRepo.DeleteCargoType(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Yük tipi silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Yük tipi silindi"})
}

// ============================================
// Vehicle Brands
// ============================================

func (h *ConfigHandler) GetVehicleBrands(c *gin.Context) {
	ctx := c.Request.Context()

	brands, err := h.cargoRepo.GetVehicleBrandsWithModels(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç markaları alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"vehicle_brands": brands})
}

func (h *ConfigHandler) CreateVehicleBrand(c *gin.Context) {
	ctx := c.Request.Context()

	var req models.VehicleBrand
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.IsActive = true
	if err := h.cargoRepo.CreateVehicleBrand(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç markası oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, req)
}

func (h *ConfigHandler) UpdateVehicleBrand(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var req models.VehicleBrand
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.ID = id
	if err := h.cargoRepo.UpdateVehicleBrand(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç markası güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, req)
}

func (h *ConfigHandler) DeleteVehicleBrand(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if err := h.cargoRepo.DeleteVehicleBrand(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç markası silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Araç markası silindi"})
}

// ============================================
// Vehicle Models
// ============================================

func (h *ConfigHandler) CreateVehicleModel(c *gin.Context) {
	ctx := c.Request.Context()
	brandID := c.Param("brand_id")

	var req models.VehicleModel
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.BrandID = brandID
	req.IsActive = true
	if err := h.cargoRepo.CreateVehicleModel(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç modeli oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, req)
}

func (h *ConfigHandler) UpdateVehicleModel(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var req models.VehicleModel
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.ID = id
	if err := h.cargoRepo.UpdateVehicleModel(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç modeli güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, req)
}

func (h *ConfigHandler) DeleteVehicleModel(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if err := h.cargoRepo.DeleteVehicleModel(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Araç modeli silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Araç modeli silindi"})
}

// ============================================
// Trailer Types
// ============================================

func (h *ConfigHandler) GetTrailerTypes(c *gin.Context) {
	ctx := c.Request.Context()

	types, err := h.cargoRepo.GetAllTrailerTypes(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Dorse tipleri alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"trailer_types": types})
}

func (h *ConfigHandler) CreateTrailerType(c *gin.Context) {
	ctx := c.Request.Context()

	var req models.TrailerTypeConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.IsActive = true
	if err := h.cargoRepo.CreateTrailerType(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Dorse tipi oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, req)
}

func (h *ConfigHandler) UpdateTrailerType(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var req models.TrailerTypeConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz veri"})
		return
	}

	req.ID = id
	if err := h.cargoRepo.UpdateTrailerType(ctx, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Dorse tipi güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, req)
}

func (h *ConfigHandler) DeleteTrailerType(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	if err := h.cargoRepo.DeleteTrailerType(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Dorse tipi silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Dorse tipi silindi"})
}
