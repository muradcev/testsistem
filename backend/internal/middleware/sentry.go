package middleware

import (
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"time"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

// SentryConfig holds Sentry configuration
type SentryConfig struct {
	DSN              string
	Environment      string
	Release          string
	TracesSampleRate float64
}

// InitSentry initializes Sentry with the given configuration
func InitSentry() error {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		fmt.Println("[INFO] Sentry DSN not configured, skipping Sentry initialization")
		return nil
	}

	environment := os.Getenv("SENTRY_ENVIRONMENT")
	if environment == "" {
		environment = "production"
	}

	release := os.Getenv("SENTRY_RELEASE")
	if release == "" {
		release = "nakliyeo-backend@1.0.0"
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      environment,
		Release:          release,
		TracesSampleRate: 1.0,
		EnableTracing:    true,
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			// Filter out sensitive data if needed
			return event
		},
		AttachStacktrace: true,
	})

	if err != nil {
		return fmt.Errorf("sentry initialization failed: %w", err)
	}

	fmt.Println("[INFO] Sentry initialized successfully")
	return nil
}

// SentryMiddleware returns a Gin middleware for Sentry error tracking
func SentryMiddleware() gin.HandlerFunc {
	return sentrygin.New(sentrygin.Options{
		Repanic: true,
	})
}

// SentryRecoveryMiddleware handles panics and reports them to Sentry
func SentryRecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Get stack trace
				stack := debug.Stack()

				// Create Sentry event
				hub := sentry.GetHubFromContext(c.Request.Context())
				if hub == nil {
					hub = sentry.CurrentHub().Clone()
				}

				hub.WithScope(func(scope *sentry.Scope) {
					scope.SetRequest(c.Request)
					scope.SetExtra("stack_trace", string(stack))
					scope.SetLevel(sentry.LevelFatal)

					// Add request context
					scope.SetTag("method", c.Request.Method)
					scope.SetTag("path", c.Request.URL.Path)
					scope.SetTag("ip", c.ClientIP())

					// Capture the error
					if e, ok := err.(error); ok {
						hub.CaptureException(e)
					} else {
						hub.CaptureMessage(fmt.Sprintf("%v", err))
					}
				})

				// Flush Sentry events
				sentry.Flush(2 * time.Second)

				// Return 500 error
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": "Internal server error",
				})
			}
		}()

		c.Next()
	}
}

// CaptureError captures an error and sends it to Sentry
func CaptureError(c *gin.Context, err error, extras map[string]interface{}) {
	hub := sentry.GetHubFromContext(c.Request.Context())
	if hub == nil {
		hub = sentry.CurrentHub().Clone()
	}

	hub.WithScope(func(scope *sentry.Scope) {
		scope.SetRequest(c.Request)

		// Add driver info if available
		if driverID, exists := c.Get("driver_id"); exists {
			scope.SetUser(sentry.User{
				ID: fmt.Sprintf("%v", driverID),
			})
		}

		// Add admin info if available
		if adminID, exists := c.Get("admin_id"); exists {
			scope.SetTag("admin_id", fmt.Sprintf("%v", adminID))
		}

		// Add extras
		for key, value := range extras {
			scope.SetExtra(key, value)
		}

		hub.CaptureException(err)
	})
}

// CaptureMessage captures a message and sends it to Sentry
func CaptureMessage(message string, level sentry.Level, extras map[string]interface{}) {
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(level)
		for key, value := range extras {
			scope.SetExtra(key, value)
		}
		sentry.CaptureMessage(message)
	})
}

// SetUserContext sets user context for Sentry
func SetUserContext(c *gin.Context, userID string, userData map[string]string) {
	hub := sentry.GetHubFromContext(c.Request.Context())
	if hub == nil {
		hub = sentry.CurrentHub().Clone()
	}

	hub.Scope().SetUser(sentry.User{
		ID:   userID,
		Data: userData,
	})
}

// FlushSentry flushes pending Sentry events
func FlushSentry() {
	sentry.Flush(5 * time.Second)
}
