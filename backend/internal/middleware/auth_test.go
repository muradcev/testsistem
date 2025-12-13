package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestGenerateAndValidateToken(t *testing.T) {
	claims := &models.TokenClaims{
		UserID: uuid.New(),
		Type:   models.TokenTypeDriver,
		Phone:  "5551234567",
		Role:   "driver",
	}

	// Generate access token
	token, err := GenerateAccessToken(claims)
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	if token == "" {
		t.Fatal("Token should not be empty")
	}

	// Validate token
	validatedClaims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if validatedClaims.UserID != claims.UserID {
		t.Errorf("UserID mismatch: expected %s, got %s", claims.UserID, validatedClaims.UserID)
	}

	if validatedClaims.Phone != claims.Phone {
		t.Errorf("Phone mismatch: expected %s, got %s", claims.Phone, validatedClaims.Phone)
	}

	if validatedClaims.Type != claims.Type {
		t.Errorf("Type mismatch: expected %s, got %s", claims.Type, validatedClaims.Type)
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	claims := &models.TokenClaims{
		UserID: uuid.New(),
		Type:   models.TokenTypeDriver,
		Phone:  "5551234567",
	}

	token, err := GenerateRefreshToken(claims)
	if err != nil {
		t.Fatalf("Failed to generate refresh token: %v", err)
	}

	if token == "" {
		t.Fatal("Refresh token should not be empty")
	}

	// Validate refresh token
	validatedClaims, err := ValidateRefreshToken(token)
	if err != nil {
		t.Fatalf("Failed to validate refresh token: %v", err)
	}

	if validatedClaims.UserID != claims.UserID {
		t.Errorf("UserID mismatch: expected %s, got %s", claims.UserID, validatedClaims.UserID)
	}
}

func TestValidateToken_InvalidToken(t *testing.T) {
	_, err := ValidateToken("invalid-token")
	if err == nil {
		t.Error("Expected error for invalid token, got nil")
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	claims := &models.TokenClaims{
		UserID: uuid.New(),
		Type:   models.TokenTypeDriver,
		Phone:  "5551234567",
	}

	// Generate a token with very short expiration
	token, err := GenerateToken(claims, -1*time.Hour) // Already expired
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	_, err = ValidateToken(token)
	if err == nil {
		t.Error("Expected error for expired token, got nil")
	}
}

func TestAuthMiddleware_NoHeader(t *testing.T) {
	router := gin.New()
	router.Use(AuthMiddleware("driver"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestAuthMiddleware_InvalidFormat(t *testing.T) {
	router := gin.New()
	router.Use(AuthMiddleware("driver"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "InvalidFormat token")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	claims := &models.TokenClaims{
		UserID: uuid.New(),
		Type:   models.TokenTypeDriver,
		Phone:  "5551234567",
	}

	token, _ := GenerateAccessToken(claims)

	router := gin.New()
	router.Use(AuthMiddleware("driver"))
	router.GET("/test", func(c *gin.Context) {
		userID, exists := GetUserID(c)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no user id"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user_id": userID.String()})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestAuthMiddleware_WrongTokenType(t *testing.T) {
	claims := &models.TokenClaims{
		UserID: uuid.New(),
		Type:   models.TokenTypeDriver,
		Phone:  "5551234567",
	}

	token, _ := GenerateAccessToken(claims)

	router := gin.New()
	router.Use(AuthMiddleware("admin")) // Expecting admin token
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestGetClaims(t *testing.T) {
	claims := &models.TokenClaims{
		UserID: uuid.New(),
		Type:   models.TokenTypeAdmin,
		Email:  "admin@test.com",
		Role:   "admin",
	}

	token, _ := GenerateAccessToken(claims)

	router := gin.New()
	router.Use(AuthMiddleware("admin"))
	router.GET("/test", func(c *gin.Context) {
		retrievedClaims, exists := GetClaims(c)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no claims"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"email": retrievedClaims.Email,
			"role":  retrievedClaims.Role,
		})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}
