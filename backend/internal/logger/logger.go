package logger

import (
	"io"
	"os"
	"time"

	"github.com/rs/zerolog"
)

var Log zerolog.Logger

func init() {
	// Default: production JSON logging
	Log = zerolog.New(os.Stdout).With().Timestamp().Logger()
}

// Init initializes the logger with the specified configuration
func Init(level string, prettyPrint bool) {
	// Set log level
	logLevel := zerolog.InfoLevel
	switch level {
	case "debug":
		logLevel = zerolog.DebugLevel
	case "info":
		logLevel = zerolog.InfoLevel
	case "warn":
		logLevel = zerolog.WarnLevel
	case "error":
		logLevel = zerolog.ErrorLevel
	}
	zerolog.SetGlobalLevel(logLevel)

	// Configure output
	var output io.Writer = os.Stdout
	if prettyPrint {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
	}

	Log = zerolog.New(output).
		With().
		Timestamp().
		Caller().
		Logger()
}

// WithRequestID creates a logger with request ID
func WithRequestID(requestID string) zerolog.Logger {
	return Log.With().Str("request_id", requestID).Logger()
}

// WithDriverID creates a logger with driver ID
func WithDriverID(driverID string) zerolog.Logger {
	return Log.With().Str("driver_id", driverID).Logger()
}

// WithAdminID creates a logger with admin ID
func WithAdminID(adminID string) zerolog.Logger {
	return Log.With().Str("admin_id", adminID).Logger()
}

// Info logs an info message
func Info(msg string) {
	Log.Info().Msg(msg)
}

// Debug logs a debug message
func Debug(msg string) {
	Log.Debug().Msg(msg)
}

// Warn logs a warning message
func Warn(msg string) {
	Log.Warn().Msg(msg)
}

// Error logs an error message
func Error(msg string, err error) {
	Log.Error().Err(err).Msg(msg)
}

// Fatal logs a fatal message and exits
func Fatal(msg string, err error) {
	Log.Fatal().Err(err).Msg(msg)
}

// API log helpers

// LogRequest logs an incoming HTTP request
func LogRequest(method, path, ip, userAgent string, statusCode int, duration time.Duration) {
	Log.Info().
		Str("method", method).
		Str("path", path).
		Str("ip", ip).
		Str("user_agent", userAgent).
		Int("status", statusCode).
		Dur("duration", duration).
		Msg("HTTP Request")
}

// LogDBQuery logs a database query
func LogDBQuery(query string, duration time.Duration, err error) {
	event := Log.Debug().
		Str("query", query).
		Dur("duration", duration)

	if err != nil {
		event.Err(err).Msg("DB Query Failed")
	} else {
		event.Msg("DB Query")
	}
}

// LogAuth logs authentication events
func LogAuth(event, userType, userID, ip string, success bool) {
	Log.Info().
		Str("event", event).
		Str("user_type", userType).
		Str("user_id", userID).
		Str("ip", ip).
		Bool("success", success).
		Msg("Auth Event")
}

// LogLocationUpdate logs location updates
func LogLocationUpdate(driverID string, lat, lng float64) {
	Log.Debug().
		Str("driver_id", driverID).
		Float64("latitude", lat).
		Float64("longitude", lng).
		Msg("Location Update")
}

// LogNotification logs notification events
func LogNotification(eventType, driverID, notifType string, success bool, err error) {
	event := Log.Info().
		Str("event", eventType).
		Str("driver_id", driverID).
		Str("notification_type", notifType).
		Bool("success", success)

	if err != nil {
		event.Err(err)
	}

	event.Msg("Notification Event")
}
