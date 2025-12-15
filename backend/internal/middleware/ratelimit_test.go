package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRateLimiter_Allow(t *testing.T) {
	limiter := &RateLimiter{
		requests: make(map[string]*clientInfo),
		limit:    5,
		window:   time.Second,
	}

	ip := "192.168.1.1"

	// İlk 5 istek izin verilmeli
	for i := 0; i < 5; i++ {
		allowed, remaining, _ := limiter.Allow(ip)
		assert.True(t, allowed, "Request %d should be allowed", i+1)
		assert.Equal(t, 5-i-1, remaining, "Remaining should be %d", 5-i-1)
	}

	// 6. istek reddedilmeli
	allowed, remaining, _ := limiter.Allow(ip)
	assert.False(t, allowed, "6th request should be denied")
	assert.Equal(t, 0, remaining, "Remaining should be 0")
}

func TestRateLimiter_WindowReset(t *testing.T) {
	limiter := &RateLimiter{
		requests: make(map[string]*clientInfo),
		limit:    2,
		window:   100 * time.Millisecond,
	}

	ip := "192.168.1.2"

	// 2 istek yap
	limiter.Allow(ip)
	limiter.Allow(ip)

	// 3. istek reddedilmeli
	allowed, _, _ := limiter.Allow(ip)
	assert.False(t, allowed, "3rd request should be denied")

	// Window süresini bekle
	time.Sleep(150 * time.Millisecond)

	// Yeni istek izin verilmeli
	allowed, remaining, _ := limiter.Allow(ip)
	assert.True(t, allowed, "Request after window reset should be allowed")
	assert.Equal(t, 1, remaining, "Remaining should be 1 after reset")
}

func TestRateLimitMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Test limiter oluştur
	limiter := &RateLimiter{
		requests: make(map[string]*clientInfo),
		limit:    3,
		window:   time.Minute,
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		ip := c.ClientIP()
		allowed, remaining, resetTime := limiter.Allow(ip)

		c.Header("X-RateLimit-Limit", "3")
		c.Header("X-RateLimit-Remaining", string(rune(remaining+'0')))

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests"})
			c.Abort()
			return
		}

		c.Next()
		_ = resetTime // unused
	})
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// İlk 3 istek başarılı olmalı
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Request %d should return 200", i+1)
	}

	// 4. istek 429 dönmeli
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code, "4th request should return 429")
}

func TestStrictRateLimitMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(StrictRateLimitMiddleware(2, time.Minute))
	router.POST("/auth/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// İlk 2 istek başarılı
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/auth/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// 3. istek reddedilmeli
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

func TestMultipleClients(t *testing.T) {
	limiter := &RateLimiter{
		requests: make(map[string]*clientInfo),
		limit:    2,
		window:   time.Minute,
	}

	ip1 := "192.168.1.1"
	ip2 := "192.168.1.2"

	// Her iki IP için 2'şer istek
	limiter.Allow(ip1)
	limiter.Allow(ip1)
	limiter.Allow(ip2)
	limiter.Allow(ip2)

	// Her iki IP için 3. istek reddedilmeli
	allowed1, _, _ := limiter.Allow(ip1)
	allowed2, _, _ := limiter.Allow(ip2)

	assert.False(t, allowed1, "IP1 3rd request should be denied")
	assert.False(t, allowed2, "IP2 3rd request should be denied")
}
