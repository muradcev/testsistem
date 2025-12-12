package api

import (
	"net/http"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SurveyHandler struct {
	surveyService *service.SurveyService
}

func NewSurveyHandler(surveyService *service.SurveyService) *SurveyHandler {
	return &SurveyHandler{surveyService: surveyService}
}

func (h *SurveyHandler) GetPendingSurveys(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	surveys, err := h.surveyService.GetPendingSurveys(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"surveys": surveys})
}

func (h *SurveyHandler) SubmitResponse(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkisiz erişim"})
		return
	}

	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz anket ID"})
		return
	}

	var req models.SurveySubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.surveyService.SubmitResponse(c.Request.Context(), userID, surveyID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Anket cevapları kaydedildi"})
}

// Admin Survey Handler
type AdminSurveyHandler struct {
	surveyService *service.SurveyService
}

func NewAdminSurveyHandler(surveyService *service.SurveyService) *AdminSurveyHandler {
	return &AdminSurveyHandler{surveyService: surveyService}
}

func (h *AdminSurveyHandler) GetAll(c *gin.Context) {
	surveys, total, err := h.surveyService.GetAll(c.Request.Context(), 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"surveys": surveys, "total": total})
}

func (h *AdminSurveyHandler) Create(c *gin.Context) {
	var req models.SurveyCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	survey, err := h.surveyService.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, survey)
}

func (h *AdminSurveyHandler) Update(c *gin.Context) {
	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz anket ID"})
		return
	}

	survey, err := h.surveyService.GetByID(c.Request.Context(), surveyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Anket bulunamadı"})
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		IsActive    *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Title != "" {
		survey.Title = req.Title
	}
	if req.Description != "" {
		survey.Description = &req.Description
	}
	if req.IsActive != nil {
		survey.IsActive = *req.IsActive
	}

	if err := h.surveyService.Update(c.Request.Context(), survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, survey)
}

func (h *AdminSurveyHandler) Delete(c *gin.Context) {
	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz anket ID"})
		return
	}

	if err := h.surveyService.Delete(c.Request.Context(), surveyID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Anket silindi"})
}

func (h *AdminSurveyHandler) GetResponses(c *gin.Context) {
	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz anket ID"})
		return
	}

	responses, err := h.surveyService.GetResponses(c.Request.Context(), surveyID, 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"responses": responses})
}
