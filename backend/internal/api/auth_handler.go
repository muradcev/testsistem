package api

import (
	"net/http"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.DriverRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driver, err := h.authService.RegisterDriver(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Kayıt başarılı",
		"driver": gin.H{
			"id":    driver.ID,
			"phone": driver.Phone,
			"name":  driver.Name,
		},
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.DriverLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	driver, authResponse, err := h.authService.LoginDriver(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"driver": gin.H{
			"id":       driver.ID,
			"phone":    driver.Phone,
			"name":     driver.Name,
			"surname":  driver.Surname,
			"province": driver.Province,
			"district": driver.District,
		},
		"auth": authResponse,
	})
}

func (h *AuthHandler) AdminLogin(c *gin.Context) {
	var req models.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	admin, authResponse, err := h.authService.LoginAdmin(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"admin": gin.H{
			"id":    admin.ID,
			"email": admin.Email,
			"name":  admin.Name,
			"role":  admin.Role,
		},
		"auth": authResponse,
	})
}

// SendOTP - SMS servisi devre dışı
func (h *AuthHandler) SendOTP(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "SMS servisi devre dışı"})
}

// VerifyOTP - SMS servisi devre dışı
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "SMS servisi devre dışı"})
}

// CheckPhoneExists - Telefon numarasının kayıtlı olup olmadığını kontrol eder
func (h *AuthHandler) CheckPhoneExists(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telefon numarası gerekli"})
		return
	}

	exists, err := h.authService.CheckPhoneExists(c.Request.Context(), req.Phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kontrol yapılamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"exists":  exists,
		"message": map[bool]string{true: "Bu telefon numarası zaten kayıtlı", false: "Telefon numarası kullanılabilir"}[exists],
	})
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req models.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Refresh token gerekli"})
		return
	}

	// Refresh token'ı doğrula
	claims, err := middleware.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz veya süresi dolmuş refresh token"})
		return
	}

	// Yeni access token oluştur
	accessToken, err := middleware.GenerateAccessToken(claims)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token oluşturulamadı"})
		return
	}

	// Yeni refresh token oluştur (opsiyonel - güvenlik için önerilir)
	refreshToken, err := middleware.GenerateRefreshToken(claims)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token oluşturulamadı"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"auth": models.AuthResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ExpiresIn:    86400, // 24 saat
			TokenType:    "Bearer",
		},
	})
}
