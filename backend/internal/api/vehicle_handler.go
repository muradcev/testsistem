package api

import (
	"fmt"
	"net/http"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type VehicleHandler struct {
	vehicleService *service.VehicleService
}

func NewVehicleHandler(vehicleService *service.VehicleService) *VehicleHandler {
	return &VehicleHandler{vehicleService: vehicleService}
}

func (h *VehicleHandler) GetAll(c *gin.Context) {
	fmt.Printf("[VehicleHandler] GetAll called\n")

	userID, ok := middleware.GetUserID(c)
	if !ok {
		fmt.Printf("[VehicleHandler] GetAll - Unauthorized access attempt\n")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	fmt.Printf("[VehicleHandler] GetAll - User ID: %s\n", userID)

	vehicles, err := h.vehicleService.GetByDriverID(c.Request.Context(), userID)
	if err != nil {
		fmt.Printf("[VehicleHandler] GetAll - Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("[VehicleHandler] GetAll - Found %d vehicles\n", len(vehicles))
	c.JSON(http.StatusOK, gin.H{"vehicles": vehicles})
}

func (h *VehicleHandler) Create(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	var req models.VehicleCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vehicle, err := h.vehicleService.Create(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, vehicle)
}

func (h *VehicleHandler) Update(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz araç ID"})
		return
	}

	var req models.VehicleUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vehicle, err := h.vehicleService.Update(c.Request.Context(), userID, vehicleID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, vehicle)
}

func (h *VehicleHandler) Delete(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz araç ID"})
		return
	}

	if err := h.vehicleService.Delete(c.Request.Context(), userID, vehicleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Araç silindi"})
}
