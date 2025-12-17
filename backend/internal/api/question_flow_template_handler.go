package api

import (
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type QuestionFlowTemplateHandler struct {
	templateRepo *repository.QuestionFlowTemplateRepository
	auditRepo    *repository.AuditRepository
}

func NewQuestionFlowTemplateHandler(templateRepo *repository.QuestionFlowTemplateRepository, auditRepo *repository.AuditRepository) *QuestionFlowTemplateHandler {
	return &QuestionFlowTemplateHandler{
		templateRepo: templateRepo,
		auditRepo:    auditRepo,
	}
}

// CreateTemplate - Yeni sablon olustur
// @Summary Yeni soru akis sablonu olustur
// @Tags Admin - Question Flow Templates
// @Accept json
// @Produce json
// @Param request body models.QuestionFlowTemplateCreateRequest true "Sablon bilgileri"
// @Success 201 {object} models.QuestionFlowTemplate
// @Router /admin/question-templates [post]
func (h *QuestionFlowTemplateHandler) CreateTemplate(c *gin.Context) {
	var req models.QuestionFlowTemplateCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz istek: " + err.Error()})
		return
	}

	// Validate nodes
	if len(req.Nodes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir soru gerekli"})
		return
	}

	// Get admin ID
	var createdBy *uuid.UUID
	if userID, exists := c.Get("userID"); exists {
		if adminID, ok := userID.(uuid.UUID); ok {
			createdBy = &adminID
		}
	}

	template, err := h.templateRepo.Create(c.Request.Context(), &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sablon olusturulamadi: " + err.Error()})
		return
	}

	// Audit log
	if h.auditRepo != nil && createdBy != nil {
		h.auditRepo.LogAction(c.Request.Context(), createdBy, "admin", "", "create", "question_flow_template", &template.ID, map[string]interface{}{
			"name":     req.Name,
			"category": req.Category,
		}, c.ClientIP(), c.GetHeader("User-Agent"))
	}

	c.JSON(http.StatusCreated, template)
}

// GetTemplates - Tum sablonlari listele
// @Summary Soru akis sablonlarini listele
// @Tags Admin - Question Flow Templates
// @Produce json
// @Param limit query int false "Limit" default(20)
// @Param offset query int false "Offset" default(0)
// @Param category query string false "Kategori"
// @Param is_active query bool false "Aktif mi?"
// @Success 200 {object} map[string]interface{}
// @Router /admin/question-templates [get]
func (h *QuestionFlowTemplateHandler) GetTemplates(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	category := c.Query("category")

	var isActive *bool
	if c.Query("is_active") != "" {
		active := c.Query("is_active") == "true"
		isActive = &active
	}

	templates, total, err := h.templateRepo.GetAll(c.Request.Context(), limit, offset, category, isActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sablonlar alinamadi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"templates": templates,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
	})
}

// GetTemplateByID - ID ile sablon getir
// @Summary Sablon detayi
// @Tags Admin - Question Flow Templates
// @Produce json
// @Param id path string true "Sablon ID"
// @Success 200 {object} models.QuestionFlowTemplate
// @Router /admin/question-templates/{id} [get]
func (h *QuestionFlowTemplateHandler) GetTemplateByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz ID"})
		return
	}

	template, err := h.templateRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sablon bulunamadi"})
		return
	}

	c.JSON(http.StatusOK, template)
}

// UpdateTemplate - Sablon guncelle
// @Summary Sablon guncelle
// @Tags Admin - Question Flow Templates
// @Accept json
// @Produce json
// @Param id path string true "Sablon ID"
// @Param request body models.QuestionFlowTemplateUpdateRequest true "Guncellenecek alanlar"
// @Success 200 {object} models.QuestionFlowTemplate
// @Router /admin/question-templates/{id} [put]
func (h *QuestionFlowTemplateHandler) UpdateTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz ID"})
		return
	}

	var req models.QuestionFlowTemplateUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz istek: " + err.Error()})
		return
	}

	template, err := h.templateRepo.Update(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sablon guncellenemedi: " + err.Error()})
		return
	}

	// Audit log
	if h.auditRepo != nil {
		if userID, exists := c.Get("userID"); exists {
			if adminID, ok := userID.(uuid.UUID); ok {
				h.auditRepo.LogAction(c.Request.Context(), &adminID, "admin", "", "update", "question_flow_template", &id, req, c.ClientIP(), c.GetHeader("User-Agent"))
			}
		}
	}

	c.JSON(http.StatusOK, template)
}

// DeleteTemplate - Sablon sil
// @Summary Sablon sil
// @Tags Admin - Question Flow Templates
// @Param id path string true "Sablon ID"
// @Success 200 {object} map[string]string
// @Router /admin/question-templates/{id} [delete]
func (h *QuestionFlowTemplateHandler) DeleteTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz ID"})
		return
	}

	if err := h.templateRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sablon silinemedi: " + err.Error()})
		return
	}

	// Audit log
	if h.auditRepo != nil {
		if userID, exists := c.Get("userID"); exists {
			if adminID, ok := userID.(uuid.UUID); ok {
				h.auditRepo.LogAction(c.Request.Context(), &adminID, "admin", "", "delete", "question_flow_template", &id, nil, c.ClientIP(), c.GetHeader("User-Agent"))
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sablon silindi"})
}

// DuplicateTemplate - Sablonu kopyala
// @Summary Sablonu kopyala
// @Tags Admin - Question Flow Templates
// @Accept json
// @Produce json
// @Param id path string true "Sablon ID"
// @Param request body object true "Yeni isim"
// @Success 201 {object} models.QuestionFlowTemplate
// @Router /admin/question-templates/{id}/duplicate [post]
func (h *QuestionFlowTemplateHandler) DuplicateTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz ID"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Yeni isim gerekli"})
		return
	}

	// Get admin ID
	var createdBy *uuid.UUID
	if userID, exists := c.Get("userID"); exists {
		if adminID, ok := userID.(uuid.UUID); ok {
			createdBy = &adminID
		}
	}

	template, err := h.templateRepo.Duplicate(c.Request.Context(), id, req.Name, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sablon kopyalanamadi: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// IncrementUsage - Kullanim sayisini artir
// @Summary Sablon kullanim sayisini artir
// @Tags Admin - Question Flow Templates
// @Param id path string true "Sablon ID"
// @Success 200 {object} map[string]string
// @Router /admin/question-templates/{id}/use [post]
func (h *QuestionFlowTemplateHandler) IncrementUsage(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gecersiz ID"})
		return
	}

	if err := h.templateRepo.IncrementUsageCount(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kullanim sayisi artirilamadi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kullanim sayisi artirildi"})
}

// GetStats - Sablon istatistikleri
// @Summary Sablon istatistikleri
// @Tags Admin - Question Flow Templates
// @Produce json
// @Success 200 {object} models.QuestionFlowTemplateStats
// @Router /admin/question-templates/stats [get]
func (h *QuestionFlowTemplateHandler) GetStats(c *gin.Context) {
	stats, err := h.templateRepo.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Istatistikler alinamadi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetCategories - Kategorileri getir
// @Summary Sablon kategorileri
// @Tags Admin - Question Flow Templates
// @Produce json
// @Success 200 {array} string
// @Router /admin/question-templates/categories [get]
func (h *QuestionFlowTemplateHandler) GetCategories(c *gin.Context) {
	categories, err := h.templateRepo.GetCategories(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kategoriler alinamadi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}
