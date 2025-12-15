package middleware

import (
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter - Basit in-memory rate limiter
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string]*clientInfo
	limit    int
	window   time.Duration
}

type clientInfo struct {
	count     int
	firstSeen time.Time
}

var (
	defaultLimiter *RateLimiter
	once           sync.Once
)

// GetRateLimiter - Singleton rate limiter instance
func GetRateLimiter() *RateLimiter {
	once.Do(func() {
		limit := 100 // Default: 100 requests
		window := time.Minute

		// Environment variable'lardan al
		if envLimit := os.Getenv("RATE_LIMIT"); envLimit != "" {
			if l, err := strconv.Atoi(envLimit); err == nil {
				limit = l
			}
		}
		if envWindow := os.Getenv("RATE_LIMIT_WINDOW"); envWindow != "" {
			if w, err := strconv.Atoi(envWindow); err == nil {
				window = time.Duration(w) * time.Second
			}
		}

		defaultLimiter = &RateLimiter{
			requests: make(map[string]*clientInfo),
			limit:    limit,
			window:   window,
		}

		// Cleanup goroutine
		go defaultLimiter.cleanup()
	})
	return defaultLimiter
}

// cleanup - Expired entries'leri temizle
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, info := range rl.requests {
			if now.Sub(info.firstSeen) > rl.window {
				delete(rl.requests, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow - IP için rate limit kontrolü
func (rl *RateLimiter) Allow(ip string) (bool, int, time.Time) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	info, exists := rl.requests[ip]

	if !exists {
		rl.requests[ip] = &clientInfo{
			count:     1,
			firstSeen: now,
		}
		return true, rl.limit - 1, now.Add(rl.window)
	}

	// Window süresi dolmuşsa reset
	if now.Sub(info.firstSeen) > rl.window {
		info.count = 1
		info.firstSeen = now
		return true, rl.limit - 1, now.Add(rl.window)
	}

	// Limit kontrolü
	if info.count >= rl.limit {
		resetTime := info.firstSeen.Add(rl.window)
		return false, 0, resetTime
	}

	info.count++
	return true, rl.limit - info.count, info.firstSeen.Add(rl.window)
}

// RateLimitMiddleware - Rate limiting middleware
func RateLimitMiddleware() gin.HandlerFunc {
	limiter := GetRateLimiter()

	return func(c *gin.Context) {
		// Client IP'sini al
		ip := c.ClientIP()
		if ip == "" {
			ip = c.Request.RemoteAddr
		}

		allowed, remaining, resetTime := limiter.Allow(ip)

		// Headers ekle
		c.Header("X-RateLimit-Limit", strconv.Itoa(limiter.limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		if !allowed {
			c.Header("Retry-After", strconv.FormatInt(int64(time.Until(resetTime).Seconds()), 10))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests",
				"retry_after": int(time.Until(resetTime).Seconds()),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// StrictRateLimitMiddleware - Daha sıkı rate limiting (auth endpoint'leri için)
func StrictRateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := &RateLimiter{
		requests: make(map[string]*clientInfo),
		limit:    limit,
		window:   window,
	}
	go limiter.cleanup()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		if ip == "" {
			ip = c.Request.RemoteAddr
		}

		allowed, remaining, resetTime := limiter.Allow(ip)

		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		if !allowed {
			c.Header("Retry-After", strconv.FormatInt(int64(time.Until(resetTime).Seconds()), 10))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests",
				"retry_after": int(time.Until(resetTime).Seconds()),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
