package middleware

import (
	"net/http"
	"os"
	"strings"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "nakliyeo-mobil-secret-key-change-in-production"
	}
	jwtSecret = []byte(secret)
}

func GetJWTSecret() []byte {
	return jwtSecret
}

func AuthMiddleware(tokenType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Yetkilendirme başlığı gerekli"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz yetkilendirme formatı"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &models.TokenClaims{}

		token, err := jwt.ParseWithClaims(tokenString, &jwtClaims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz veya süresi dolmuş token"})
			c.Abort()
			return
		}

		jwtCl, ok := token.Claims.(*jwtClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz token claims"})
			c.Abort()
			return
		}

		claims.UserID = jwtCl.UserID
		claims.Type = jwtCl.Type
		claims.Phone = jwtCl.Phone
		claims.Email = jwtCl.Email
		claims.Role = jwtCl.Role

		// Token tipini kontrol et
		if string(claims.Type) != tokenType {
			c.JSON(http.StatusForbidden, gin.H{"error": "Bu işlem için yetkiniz yok"})
			c.Abort()
			return
		}

		// Context'e kullanıcı bilgilerini ekle
		c.Set("userID", claims.UserID)
		c.Set("userType", claims.Type)
		c.Set("claims", claims)

		c.Next()
	}
}

type jwtClaims struct {
	UserID uuid.UUID        `json:"user_id"`
	Type   models.TokenType `json:"type"`
	Phone  string           `json:"phone,omitempty"`
	Email  string           `json:"email,omitempty"`
	Role   string           `json:"role,omitempty"`
	jwt.RegisteredClaims
}

func GenerateToken(claims *models.TokenClaims, duration time.Duration) (string, error) {
	jwtCl := &jwtClaims{
		UserID: claims.UserID,
		Type:   claims.Type,
		Phone:  claims.Phone,
		Email:  claims.Email,
		Role:   claims.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtCl)
	return token.SignedString(jwtSecret)
}

func GenerateAccessToken(claims *models.TokenClaims) (string, error) {
	return GenerateToken(claims, 24*time.Hour)
}

func GenerateRefreshToken(claims *models.TokenClaims) (string, error) {
	return GenerateToken(claims, 7*24*time.Hour)
}

func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false
	}
	return userID.(uuid.UUID), true
}

func GetClaims(c *gin.Context) (*models.TokenClaims, bool) {
	claims, exists := c.Get("claims")
	if !exists {
		return nil, false
	}
	return claims.(*models.TokenClaims), true
}

// ValidateRefreshToken - Refresh token'ı doğrula ve claims döndür
func ValidateRefreshToken(tokenString string) (*models.TokenClaims, error) {
	jwtCl := &jwtClaims{}

	token, err := jwt.ParseWithClaims(tokenString, jwtCl, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, err
	}

	claims := &models.TokenClaims{
		UserID: jwtCl.UserID,
		Type:   jwtCl.Type,
		Phone:  jwtCl.Phone,
		Email:  jwtCl.Email,
		Role:   jwtCl.Role,
	}

	return claims, nil
}
