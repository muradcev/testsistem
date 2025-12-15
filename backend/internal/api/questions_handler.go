package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type QuestionsHandler struct {
	repo                *repository.QuestionsRepository
	driverRepo          *repository.DriverRepository
	notificationService *service.NotificationService
}

func NewQuestionsHandler(repo *repository.QuestionsRepository, driverRepo *repository.DriverRepository, notificationService *service.NotificationService) *QuestionsHandler {
	return &QuestionsHandler{
		repo:                repo,
		driverRepo:          driverRepo,
		notificationService: notificationService,
	}
}

// ============================================
// Driver Questions (Kullanıcı Bazlı Sorular)
// ============================================

// CreateQuestion - Admin'in kullanıcıya özel soru oluşturması
func (h *QuestionsHandler) CreateQuestion(c *gin.Context) {
	var req models.CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert options to JSON
	var optionsJSON json.RawMessage
	if len(req.Options) > 0 {
		data, _ := json.Marshal(req.Options)
		optionsJSON = data
	}

	// Convert follow-up questions to JSON
	var followUpJSON json.RawMessage
	if len(req.FollowUpQuestions) > 0 {
		data, _ := json.Marshal(req.FollowUpQuestions)
		followUpJSON = data
	}

	// Convert context data to JSON
	var contextJSON json.RawMessage
	if len(req.ContextData) > 0 {
		data, _ := json.Marshal(req.ContextData)
		contextJSON = data
	}

	// Determine initial status
	status := "draft"
	if req.SendImmediately {
		status = "approved" // Skip approval for manual questions from admin
	}

	question := &models.DriverQuestion{
		DriverID:          req.DriverID,
		QuestionText:      req.QuestionText,
		QuestionType:      req.QuestionType,
		Options:           optionsJSON,
		FollowUpQuestions: followUpJSON,
		SourceType:        "manual",
		Status:            status,
		ContextType:       req.ContextType,
		ContextData:       contextJSON,
		RelatedTripID:     req.RelatedTripID,
		Priority:          req.Priority,
		ExpiresAt:         req.ExpiresAt,
		ScheduledFor:      req.ScheduledFor,
	}

	if err := h.repo.CreateQuestion(c.Request.Context(), question); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Soru oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":  true,
		"question": question,
	})
}

// UpdateQuestion - Soru güncelleme (sadece draft/pending_approval durumundakiler)
func (h *QuestionsHandler) UpdateQuestion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	// Mevcut soruyu al
	existing, err := h.repo.GetQuestionByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Soru bulunamadı"})
		return
	}

	// Sadece draft veya pending_approval durumundaki sorular düzenlenebilir
	if existing.Status != "draft" && existing.Status != "pending_approval" && existing.Status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bu durumdaki sorular düzenlenemez"})
		return
	}

	var req struct {
		QuestionText      string                 `json:"question_text"`
		QuestionType      string                 `json:"question_type"`
		Options           []string               `json:"options"`
		FollowUpQuestions []models.FollowUpQuestion `json:"follow_up_questions"`
		Priority          *int                   `json:"priority"`
		ExpiresAt         *string                `json:"expires_at"`
		ScheduledFor      *string                `json:"scheduled_for"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert options to JSON
	var optionsJSON json.RawMessage
	if len(req.Options) > 0 {
		data, _ := json.Marshal(req.Options)
		optionsJSON = data
	}

	// Convert follow-up questions to JSON
	var followUpJSON json.RawMessage
	if len(req.FollowUpQuestions) > 0 {
		data, _ := json.Marshal(req.FollowUpQuestions)
		followUpJSON = data
	}

	update := &models.DriverQuestionUpdate{
		QuestionText:      req.QuestionText,
		QuestionType:      req.QuestionType,
		Options:           optionsJSON,
		FollowUpQuestions: followUpJSON,
		Priority:          req.Priority,
	}

	if err := h.repo.UpdateQuestion(c.Request.Context(), id, update); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Güncelleme başarısız"})
		return
	}

	// Güncellenmiş soruyu döndür
	updated, _ := h.repo.GetQuestionByID(c.Request.Context(), id)
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"question": updated,
	})
}

// DeleteQuestion - Soru silme (sadece draft durumundakiler)
func (h *QuestionsHandler) DeleteQuestion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	// Mevcut soruyu al
	existing, err := h.repo.GetQuestionByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Soru bulunamadı"})
		return
	}

	// Sadece draft durumundaki sorular silinebilir
	if existing.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sadece taslak durumdaki sorular silinebilir"})
		return
	}

	if err := h.repo.DeleteQuestion(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Silme başarısız"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetQuestion - Soru detayı
func (h *QuestionsHandler) GetQuestion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	question, err := h.repo.GetQuestionByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Soru bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"question": question})
}

// GetDriverQuestions - Şoföre ait sorular
func (h *QuestionsHandler) GetDriverQuestions(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
		return
	}

	status := c.Query("status")
	questions, err := h.repo.GetDriverQuestions(c.Request.Context(), driverID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sorular alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"questions": questions})
}

// GetPendingQuestionsForDriver - Şoförün cevaplaması gereken sorular (mobil için)
func (h *QuestionsHandler) GetPendingQuestionsForDriver(c *gin.Context) {
	// Check if driver_id is in URL param (admin route) or context (driver route)
	var driverID uuid.UUID
	var err error

	if paramID := c.Param("driver_id"); paramID != "" {
		driverID, err = uuid.Parse(paramID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz şoför ID"})
			return
		}
	} else {
		// Get from auth context (driver's own request) - middleware sets "userID"
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı kimliği bulunamadı"})
			return
		}
		driverID = userID.(uuid.UUID)
	}

	questions, err := h.repo.GetPendingQuestions(c.Request.Context(), driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sorular alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"questions": questions})
}

// GetPendingApprovalQuestions - Onay bekleyen sorular (admin için)
func (h *QuestionsHandler) GetPendingApprovalQuestions(c *gin.Context) {
	questions, err := h.repo.GetPendingApprovalQuestions(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sorular alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"questions": questions})
}

// ApproveQuestion - Soruyu onayla/reddet
func (h *QuestionsHandler) ApproveQuestion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var req models.ApproveQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get admin ID from context (set by auth middleware as "userID")
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Admin kimliği bulunamadı"})
		return
	}
	adminID := userID.(uuid.UUID)

	if req.Approved {
		if err := h.repo.ApproveQuestion(c.Request.Context(), id, adminID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Onaylama başarısız"})
			return
		}
	} else {
		if err := h.repo.RejectQuestion(c.Request.Context(), id, adminID, req.RejectionReason); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Reddetme başarısız"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AnswerQuestion - Şoförün soruyu cevaplaması
func (h *QuestionsHandler) AnswerQuestion(c *gin.Context) {
	questionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var req models.AnswerQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get driver ID from context (set by auth middleware as "userID")
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kullanıcı kimliği bulunamadı"})
		return
	}
	driverID := userID.(uuid.UUID)

	// Determine answer type
	answerType := "text"
	if req.AnswerValue == "true" || req.AnswerValue == "false" {
		answerType = "boolean"
	} else if _, err := json.Marshal(req.AnswerValue); err == nil {
		// Check if it's a number
		var num float64
		if json.Unmarshal([]byte(req.AnswerValue), &num) == nil {
			answerType = "number"
		}
	}

	// Convert follow-up answers to JSON
	var followUpJSON json.RawMessage
	if len(req.FollowUpAnswers) > 0 {
		data, _ := json.Marshal(req.FollowUpAnswers)
		followUpJSON = data
	}

	answer := &models.DriverQuestionAnswer{
		QuestionID:            questionID,
		DriverID:              driverID,
		AnswerValue:           req.AnswerValue,
		AnswerType:            answerType,
		FollowUpAnswers:       followUpJSON,
		AnswerDurationSeconds: &req.AnswerDurationSeconds,
		Latitude:              req.Latitude,
		Longitude:             req.Longitude,
	}

	if err := h.repo.CreateAnswer(c.Request.Context(), answer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cevap kaydedilemedi"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"answer":  answer,
	})
}

// CreateBulkQuestions - Seçilen şoförlere toplu soru oluştur
func (h *QuestionsHandler) CreateBulkQuestions(c *gin.Context) {
	var req models.BulkQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.DriverIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir şoför seçilmeli"})
		return
	}

	// Convert options to JSON
	var optionsJSON json.RawMessage
	if len(req.Options) > 0 {
		data, _ := json.Marshal(req.Options)
		optionsJSON = data
	}

	// Convert follow-up questions to JSON
	var followUpJSON json.RawMessage
	if len(req.FollowUpQuestions) > 0 {
		data, _ := json.Marshal(req.FollowUpQuestions)
		followUpJSON = data
	}

	// Convert context data to JSON
	var contextJSON json.RawMessage
	if len(req.ContextData) > 0 {
		data, _ := json.Marshal(req.ContextData)
		contextJSON = data
	}

	// Determine initial status
	status := "approved" // Bulk questions go directly to approved
	if req.SendImmediately {
		status = "sent"
	}

	result := &models.BulkQuestionResult{
		TotalCount:   len(req.DriverIDs),
		SuccessCount: 0,
		FailedCount:  0,
		FailedIDs:    []uuid.UUID{},
		CreatedIDs:   []uuid.UUID{},
	}

	// Her şoför için soru oluştur
	for _, driverID := range req.DriverIDs {
		question := &models.DriverQuestion{
			DriverID:          driverID,
			QuestionText:      req.QuestionText,
			QuestionType:      req.QuestionType,
			Options:           optionsJSON,
			FollowUpQuestions: followUpJSON,
			SourceType:        "manual_bulk",
			Status:            status,
			ContextType:       req.ContextType,
			ContextData:       contextJSON,
			Priority:          req.Priority,
			ExpiresAt:         req.ExpiresAt,
			ScheduledFor:      req.ScheduledFor,
		}

		if err := h.repo.CreateQuestion(c.Request.Context(), question); err != nil {
			result.FailedCount++
			result.FailedIDs = append(result.FailedIDs, driverID)
			continue
		}

		result.SuccessCount++
		result.CreatedIDs = append(result.CreatedIDs, question.ID)

		// Hemen gönder ve bildirim at
		if req.SendImmediately && h.driverRepo != nil && h.notificationService != nil {
			driver, err := h.driverRepo.GetByID(c.Request.Context(), driverID)
			if err == nil && driver != nil && driver.FCMToken != nil && *driver.FCMToken != "" {
				fcmToken := *driver.FCMToken
				questionID := question.ID.String()
				questionText := question.QuestionText
				go func() {
					_ = h.notificationService.SendQuestionNotification(
						c.Request.Context(),
						fcmToken,
						questionID,
						questionText,
					)
				}()
			}
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"result":  result,
	})
}

// CreateFilteredBulkQuestions - Filtreye göre şoförlere toplu soru oluştur
func (h *QuestionsHandler) CreateFilteredBulkQuestions(c *gin.Context) {
	var req models.FilteredBulkQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Filtreye göre şoförleri bul
	var driverIDs []uuid.UUID

	if req.Filter.AllDrivers {
		// Tüm aktif şoförler
		drivers, err := h.repo.GetAllActiveDrivers(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoförler alınamadı"})
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	} else if req.Filter.OnTrip != nil && *req.Filter.OnTrip {
		// Seferde olan şoförler
		drivers, err := h.repo.GetDriversOnTrip(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoförler alınamadı"})
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	} else if req.Filter.IdleHoursMin != nil {
		// Beklemedeki şoförler
		drivers, err := h.repo.GetIdleDrivers(c.Request.Context(), float64(*req.Filter.IdleHoursMin))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoförler alınamadı"})
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	} else if req.Filter.RecentTripHours != nil {
		// Son X saat içinde sefer bitirmiş şoförler
		drivers, err := h.repo.GetDriversWithCompletedTrip(c.Request.Context(), *req.Filter.RecentTripHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoförler alınamadı"})
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	} else if req.Filter.Province != nil {
		// İle göre şoförler
		drivers, err := h.repo.GetDriversByProvince(c.Request.Context(), *req.Filter.Province)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Şoförler alınamadı"})
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az bir filtre kriteri belirtilmeli"})
		return
	}

	if len(driverIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"result": models.BulkQuestionResult{
				TotalCount:   0,
				SuccessCount: 0,
				FailedCount:  0,
				FailedIDs:    []uuid.UUID{},
				CreatedIDs:   []uuid.UUID{},
			},
			"message": "Filtreye uyan şoför bulunamadı",
		})
		return
	}

	// BulkQuestionRequest'e dönüştür ve mevcut fonksiyonu çağır
	bulkReq := models.BulkQuestionRequest{
		DriverIDs:         driverIDs,
		QuestionText:      req.QuestionText,
		QuestionType:      req.QuestionType,
		Options:           req.Options,
		FollowUpQuestions: req.FollowUpQuestions,
		ContextType:       req.ContextType,
		ContextData:       req.ContextData,
		Priority:          req.Priority,
		ExpiresAt:         req.ExpiresAt,
		ScheduledFor:      req.ScheduledFor,
		SendImmediately:   req.SendImmediately,
	}

	// Request body'yi değiştirip tekrar çağırmak yerine direkt işle
	h.processBulkQuestions(c, &bulkReq)
}

// processBulkQuestions - Toplu soru işleme (internal)
func (h *QuestionsHandler) processBulkQuestions(c *gin.Context, req *models.BulkQuestionRequest) {
	// Convert options to JSON
	var optionsJSON json.RawMessage
	if len(req.Options) > 0 {
		data, _ := json.Marshal(req.Options)
		optionsJSON = data
	}

	// Convert follow-up questions to JSON
	var followUpJSON json.RawMessage
	if len(req.FollowUpQuestions) > 0 {
		data, _ := json.Marshal(req.FollowUpQuestions)
		followUpJSON = data
	}

	// Convert context data to JSON
	var contextJSON json.RawMessage
	if len(req.ContextData) > 0 {
		data, _ := json.Marshal(req.ContextData)
		contextJSON = data
	}

	status := "approved"
	if req.SendImmediately {
		status = "sent"
	}

	result := &models.BulkQuestionResult{
		TotalCount:   len(req.DriverIDs),
		SuccessCount: 0,
		FailedCount:  0,
		FailedIDs:    []uuid.UUID{},
		CreatedIDs:   []uuid.UUID{},
	}

	for _, driverID := range req.DriverIDs {
		question := &models.DriverQuestion{
			DriverID:          driverID,
			QuestionText:      req.QuestionText,
			QuestionType:      req.QuestionType,
			Options:           optionsJSON,
			FollowUpQuestions: followUpJSON,
			SourceType:        "manual_bulk",
			Status:            status,
			ContextType:       req.ContextType,
			ContextData:       contextJSON,
			Priority:          req.Priority,
			ExpiresAt:         req.ExpiresAt,
			ScheduledFor:      req.ScheduledFor,
		}

		if err := h.repo.CreateQuestion(c.Request.Context(), question); err != nil {
			result.FailedCount++
			result.FailedIDs = append(result.FailedIDs, driverID)
			continue
		}

		result.SuccessCount++
		result.CreatedIDs = append(result.CreatedIDs, question.ID)

		if req.SendImmediately && h.driverRepo != nil && h.notificationService != nil {
			driver, err := h.driverRepo.GetByID(c.Request.Context(), driverID)
			if err == nil && driver != nil && driver.FCMToken != nil && *driver.FCMToken != "" {
				fcmToken := *driver.FCMToken
				questionID := question.ID.String()
				questionText := question.QuestionText
				go func() {
					_ = h.notificationService.SendQuestionNotification(
						c.Request.Context(),
						fcmToken,
						questionID,
						questionText,
					)
				}()
			}
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"result":  result,
	})
}

// SendQuestion - Onaylı soruyu gönder
func (h *QuestionsHandler) SendQuestion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	// Soru bilgisini al
	question, err := h.repo.GetQuestionByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Soru bulunamadı"})
		return
	}

	// Mark as sent
	if err := h.repo.MarkQuestionSent(c.Request.Context(), id, nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gönderme başarısız"})
		return
	}

	// Şoförün FCM token'ını al ve push bildirimi gönder
	if h.driverRepo != nil && h.notificationService != nil {
		driver, err := h.driverRepo.GetByID(c.Request.Context(), question.DriverID)
		if err == nil && driver != nil && driver.FCMToken != nil && *driver.FCMToken != "" {
			fcmToken := *driver.FCMToken
			questionID := question.ID.String()
			questionText := question.QuestionText
			go func() {
				_ = h.notificationService.SendQuestionNotification(
					c.Request.Context(),
					fcmToken,
					questionID,
					questionText,
				)
			}()
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Soru gönderildi"})
}

// ============================================
// Question Rules (Soru Kuralları)
// ============================================

func (h *QuestionsHandler) GetRules(c *gin.Context) {
	rules, err := h.repo.GetAllRules(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kurallar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *QuestionsHandler) GetRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	rule, err := h.repo.GetRuleByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kural bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

func (h *QuestionsHandler) CreateRule(c *gin.Context) {
	var rule models.QuestionRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.CreateRule(c.Request.Context(), &rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kural oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"rule": rule})
}

func (h *QuestionsHandler) UpdateRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var rule models.QuestionRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.ID = id

	if err := h.repo.UpdateRule(c.Request.Context(), &rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kural güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rule": rule})
}

func (h *QuestionsHandler) DeleteRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	if err := h.repo.DeleteRule(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kural silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// Survey Templates (Anket Şablonları)
// ============================================

func (h *QuestionsHandler) GetSurveyTemplates(c *gin.Context) {
	activeOnly := c.Query("active") == "true"
	templates, err := h.repo.GetSurveyTemplates(c.Request.Context(), activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablonlar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *QuestionsHandler) GetSurveyTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	template, err := h.repo.GetSurveyTemplateByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şablon bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"template": template})
}

func (h *QuestionsHandler) CreateSurveyTemplate(c *gin.Context) {
	var template models.SurveyTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.CreateSurveyTemplate(c.Request.Context(), &template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablon oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"template": template})
}

func (h *QuestionsHandler) UpdateSurveyTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var template models.SurveyTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	template.ID = id

	if err := h.repo.UpdateSurveyTemplate(c.Request.Context(), &template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablon güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"template": template})
}

func (h *QuestionsHandler) DeleteSurveyTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	if err := h.repo.DeleteSurveyTemplate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablon silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Template Questions
func (h *QuestionsHandler) AddTemplateQuestion(c *gin.Context) {
	templateID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var question models.SurveyTemplateQuestion
	if err := c.ShouldBindJSON(&question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	question.TemplateID = templateID

	if err := h.repo.AddTemplateQuestion(c.Request.Context(), &question); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Soru eklenemedi"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"question": question})
}

func (h *QuestionsHandler) UpdateTemplateQuestion(c *gin.Context) {
	questionID, err := uuid.Parse(c.Param("question_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var question models.SurveyTemplateQuestion
	if err := c.ShouldBindJSON(&question); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	question.ID = questionID

	if err := h.repo.UpdateTemplateQuestion(c.Request.Context(), &question); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Soru güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"question": question})
}

func (h *QuestionsHandler) DeleteTemplateQuestion(c *gin.Context) {
	questionID, err := uuid.Parse(c.Param("question_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	if err := h.repo.DeleteTemplateQuestion(c.Request.Context(), questionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Soru silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// Notification Templates (Bildirim Şablonları)
// ============================================

func (h *QuestionsHandler) GetNotificationTemplates(c *gin.Context) {
	activeOnly := c.Query("active") == "true"
	templates, err := h.repo.GetNotificationTemplates(c.Request.Context(), activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablonlar alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *QuestionsHandler) GetNotificationTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	template, err := h.repo.GetNotificationTemplateByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Şablon bulunamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"template": template})
}

func (h *QuestionsHandler) CreateNotificationTemplate(c *gin.Context) {
	var template models.NotificationTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.repo.CreateNotificationTemplate(c.Request.Context(), &template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablon oluşturulamadı"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"template": template})
}

func (h *QuestionsHandler) UpdateNotificationTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	var template models.NotificationTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	template.ID = id

	if err := h.repo.UpdateNotificationTemplate(c.Request.Context(), &template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablon güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"template": template})
}

func (h *QuestionsHandler) DeleteNotificationTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	if err := h.repo.DeleteNotificationTemplate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Şablon silinemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================
// Context & Statistics
// ============================================

// GetDriverContext - Şoförün mevcut bağlamı (akıllı soru için)
func (h *QuestionsHandler) GetDriverContext(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
		return
	}

	context := make(map[string]interface{})

	// Check if on trip
	driversOnTrip, _ := h.repo.GetDriversOnTrip(c.Request.Context())
	for _, d := range driversOnTrip {
		if d.DriverID == driverID {
			context["on_trip"] = true
			context["trip_info"] = d
			break
		}
	}

	// Check recent completed trips
	completedTrips, _ := h.repo.GetDriversWithCompletedTrip(c.Request.Context(), 168) // Last 7 days
	var recentTrips []models.DriverTripCompleted
	for _, t := range completedTrips {
		if t.DriverID == driverID {
			recentTrips = append(recentTrips, t)
		}
	}
	if len(recentTrips) > 0 {
		context["recent_trips"] = recentTrips
	}

	// Check if idle
	idleDrivers, _ := h.repo.GetIdleDrivers(c.Request.Context(), 2)
	for _, d := range idleDrivers {
		if d.DriverID == driverID {
			context["is_idle"] = true
			context["idle_info"] = d
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{"context": context})
}

// GetDriversOnTrip - Seferde olan şoförler
func (h *QuestionsHandler) GetDriversOnTrip(c *gin.Context) {
	drivers, err := h.repo.GetDriversOnTrip(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Veriler alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"drivers": drivers})
}

// GetIdleDrivers - Beklemede olan şoförler
func (h *QuestionsHandler) GetIdleDrivers(c *gin.Context) {
	drivers, err := h.repo.GetIdleDrivers(c.Request.Context(), 2)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Veriler alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"drivers": drivers})
}

// GetQuestionStats - Soru istatistikleri
func (h *QuestionsHandler) GetQuestionStats(c *gin.Context) {
	stats, err := h.repo.GetQuestionStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "İstatistikler alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// GetAnsweredQuestions - Tüm cevaplanan sorular (admin için)
func (h *QuestionsHandler) GetAnsweredQuestions(c *gin.Context) {
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

	questions, err := h.repo.GetAnsweredQuestions(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cevaplanan sorular alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"questions": questions})
}

// GetTriggerTypes - Tetikleyici tipleri
func (h *QuestionsHandler) GetTriggerTypes(c *gin.Context) {
	types, err := h.repo.GetSurveyTriggerTypes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Veriler alınamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"trigger_types": types})
}
