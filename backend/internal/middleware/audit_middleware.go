package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditMiddleware - Admin işlemlerini otomatik loglar
func AuditMiddleware(auditRepo *repository.AuditRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Sadece admin route'larını logla
		if !strings.Contains(c.Request.URL.Path, "/admin/") {
			c.Next()
			return
		}

		// GET isteklerini loglama (çok fazla log oluşturur)
		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		// Request body'yi oku
		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// İşlemi yap
		c.Next()

		// Response başarılı mı kontrol et
		if c.Writer.Status() >= 400 {
			return // Başarısız işlemleri loglama
		}

		// User bilgilerini al
		var userID *uuid.UUID
		var userEmail string
		if id, exists := c.Get("userID"); exists {
			uid := id.(uuid.UUID)
			userID = &uid
		}
		if email, exists := c.Get("userEmail"); exists {
			userEmail = email.(string)
		}

		// Action ve resource type belirle
		action := determineAction(c.Request.Method)
		resourceType, resourceID := determineResource(c.Request.URL.Path)

		// Details hazırla
		var details map[string]interface{}
		if len(bodyBytes) > 0 {
			json.Unmarshal(bodyBytes, &details)
			// Hassas bilgileri temizle
			delete(details, "password")
			delete(details, "password_hash")
			delete(details, "token")
		}

		// IP ve User Agent
		ipAddress := c.ClientIP()
		userAgent := c.Request.UserAgent()

		// Audit log kaydet
		go func() {
			_ = auditRepo.LogAction(
				c.Request.Context(),
				userID,
				"admin",
				userEmail,
				action,
				resourceType,
				resourceID,
				details,
				ipAddress,
				userAgent,
			)
		}()
	}
}

func determineAction(method string) string {
	switch method {
	case "POST":
		return models.AuditActionCreate
	case "PUT", "PATCH":
		return models.AuditActionUpdate
	case "DELETE":
		return models.AuditActionDelete
	default:
		return "unknown"
	}
}

func determineResource(path string) (string, *uuid.UUID) {
	parts := strings.Split(path, "/")

	// /api/v1/admin/{resource}/{id} formatı
	var resourceType string
	var resourceID *uuid.UUID

	for i, part := range parts {
		switch part {
		case "drivers":
			resourceType = models.AuditResourceDriver
		case "vehicles":
			resourceType = models.AuditResourceVehicle
		case "trailers":
			resourceType = models.AuditResourceTrailer
		case "questions":
			resourceType = models.AuditResourceQuestion
		case "surveys", "survey-templates":
			resourceType = models.AuditResourceSurvey
		case "trips":
			resourceType = models.AuditResourceTrip
		case "settings":
			resourceType = models.AuditResourceSettings
		case "notifications", "notification-templates":
			resourceType = models.AuditResourceNotification
		}

		// ID kontrolü (UUID formatında mı?)
		if resourceType != "" && i+1 < len(parts) {
			if id, err := uuid.Parse(parts[i+1]); err == nil {
				resourceID = &id
				break
			}
		}
	}

	if resourceType == "" {
		resourceType = "general"
	}

	return resourceType, resourceID
}
