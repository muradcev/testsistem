package middleware

import (
	"time"

	"nakliyeo-mobil/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// LoggingMiddleware - HTTP request logging middleware
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate request ID
		requestID := uuid.New().String()
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		// Start timer
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Get client IP
		clientIP := c.ClientIP()
		if clientIP == "" {
			clientIP = c.Request.RemoteAddr
		}

		// Get user agent
		userAgent := c.Request.UserAgent()

		// Full path with query
		fullPath := path
		if query != "" {
			fullPath = path + "?" + query
		}

		// Log request
		logger.Log.Info().
			Str("request_id", requestID).
			Str("method", c.Request.Method).
			Str("path", fullPath).
			Str("ip", clientIP).
			Str("user_agent", userAgent).
			Int("status", c.Writer.Status()).
			Int("size", c.Writer.Size()).
			Dur("duration", duration).
			Msg("HTTP Request")
	}
}

// RequestIDFromContext gets request ID from Gin context
func RequestIDFromContext(c *gin.Context) string {
	if id, exists := c.Get("request_id"); exists {
		return id.(string)
	}
	return ""
}
