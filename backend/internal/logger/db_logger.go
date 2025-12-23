package logger

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DBPool interface - veritabanı işlemleri için
type DBPool interface {
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

// DBLogger - Veritabanına log yazan logger
type DBLogger struct {
	pool       DBPool
	buffer     []BackendLog
	bufferLock sync.Mutex
	batchSize  int
	ticker     *time.Ticker
	done       chan bool
}

// BackendLog - Backend log kaydı
type BackendLog struct {
	ID        uuid.UUID              `json:"id"`
	Level     string                 `json:"level"`
	Category  string                 `json:"category"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Source    string                 `json:"source"` // "backend"
	Component string                 `json:"component,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
	DriverID  *uuid.UUID             `json:"driver_id,omitempty"`
	AdminID   *uuid.UUID             `json:"admin_id,omitempty"`
	IP        string                 `json:"ip,omitempty"`
	Duration  *int64                 `json:"duration_ms,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// Global DB Logger instance
var dbLogger *DBLogger

// InitDBLogger - DB Logger'ı başlat
func InitDBLogger(pool DBPool) {
	dbLogger = &DBLogger{
		pool:      pool,
		buffer:    make([]BackendLog, 0, 100),
		batchSize: 50,
		ticker:    time.NewTicker(30 * time.Second),
		done:      make(chan bool),
	}

	// Periyodik flush goroutine
	go dbLogger.flushLoop()

	Info("DB Logger initialized")
}

// flushLoop - Periyodik olarak buffer'ı veritabanına yaz
func (l *DBLogger) flushLoop() {
	for {
		select {
		case <-l.ticker.C:
			l.Flush()
		case <-l.done:
			l.Flush() // Son flush
			return
		}
	}
}

// Flush - Buffer'daki logları veritabanına yaz
func (l *DBLogger) Flush() {
	l.bufferLock.Lock()
	if len(l.buffer) == 0 {
		l.bufferLock.Unlock()
		return
	}

	logsToWrite := make([]BackendLog, len(l.buffer))
	copy(logsToWrite, l.buffer)
	l.buffer = l.buffer[:0]
	l.bufferLock.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, log := range logsToWrite {
		metadataJSON, _ := json.Marshal(log.Metadata)

		_, err := l.pool.Exec(ctx, `
			INSERT INTO app_logs (
				id, driver_id, level, category, message, metadata,
				device_id, device_model, client_time, server_time
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		`,
			log.ID,
			log.DriverID,
			log.Level,
			log.Category,
			log.Message,
			metadataJSON,
			"backend",       // device_id olarak "backend" kullan
			log.Component,   // device_model olarak component
			log.Timestamp,   // client_time
		)

		if err != nil {
			// Console'a yaz, db'ye yazma (sonsuz döngü önle)
			Log.Error().Err(err).Msg("Failed to write log to database")
		}
	}
}

// Stop - Logger'ı durdur
func (l *DBLogger) Stop() {
	l.ticker.Stop()
	l.done <- true
}

// addLog - Buffer'a log ekle
func (l *DBLogger) addLog(log BackendLog) {
	l.bufferLock.Lock()
	defer l.bufferLock.Unlock()

	l.buffer = append(l.buffer, log)

	// Buffer doluysa hemen flush
	if len(l.buffer) >= l.batchSize {
		go l.Flush()
	}
}

// ========== PUBLIC LOG METHODS ==========

// LogToDB - Genel log metodu
func LogToDB(level, category, message string, metadata map[string]interface{}) {
	if dbLogger == nil {
		return
	}

	log := BackendLog{
		ID:        uuid.New(),
		Level:     level,
		Category:  category,
		Message:   message,
		Metadata:  metadata,
		Source:    "backend",
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)

	// Console'a da yaz
	switch level {
	case "error", "critical":
		Log.Error().Interface("metadata", metadata).Msg(message)
	case "warning":
		Log.Warn().Interface("metadata", metadata).Msg(message)
	case "debug":
		Log.Debug().Interface("metadata", metadata).Msg(message)
	default:
		Log.Info().Interface("metadata", metadata).Msg(message)
	}
}

// LogAPIRequest - API isteği logla
func LogAPIRequest(method, path, ip, userAgent string, statusCode int, duration time.Duration, driverID, adminID *uuid.UUID, requestID string) {
	if dbLogger == nil {
		return
	}

	durationMs := duration.Milliseconds()
	level := "info"
	if statusCode >= 500 {
		level = "error"
	} else if statusCode >= 400 {
		level = "warning"
	}

	log := BackendLog{
		ID:       uuid.New(),
		Level:    level,
		Category: "api",
		Message:  method + " " + path,
		Metadata: map[string]interface{}{
			"method":      method,
			"path":        path,
			"status_code": statusCode,
			"user_agent":  userAgent,
		},
		Source:    "backend",
		Component: "api",
		RequestID: requestID,
		DriverID:  driverID,
		AdminID:   adminID,
		IP:        ip,
		Duration:  &durationMs,
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)
}

// LogAuthEvent - Authentication olayı logla
func LogAuthEvent(event string, success bool, driverID, adminID *uuid.UUID, ip string, err error) {
	if dbLogger == nil {
		return
	}

	level := "info"
	if !success {
		level = "warning"
	}

	metadata := map[string]interface{}{
		"event":   event,
		"success": success,
	}

	var errorStr string
	if err != nil {
		errorStr = err.Error()
		metadata["error"] = errorStr
		level = "error"
	}

	log := BackendLog{
		ID:        uuid.New(),
		Level:     level,
		Category:  "auth",
		Message:   "Auth: " + event,
		Metadata:  metadata,
		Source:    "backend",
		Component: "auth",
		DriverID:  driverID,
		AdminID:   adminID,
		IP:        ip,
		Error:     errorStr,
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)
}

// LogLocationEvent - Konum olayı logla
func LogLocationEvent(event string, driverID uuid.UUID, lat, lng float64, metadata map[string]interface{}) {
	if dbLogger == nil {
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["latitude"] = lat
	metadata["longitude"] = lng

	log := BackendLog{
		ID:        uuid.New(),
		Level:     "info",
		Category:  "location",
		Message:   "Location: " + event,
		Metadata:  metadata,
		Source:    "backend",
		Component: "location",
		DriverID:  &driverID,
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)
}

// LogNotificationEvent - Bildirim olayı logla
func LogNotificationEvent(event, notifType string, driverID *uuid.UUID, success bool, err error) {
	if dbLogger == nil {
		return
	}

	level := "info"
	metadata := map[string]interface{}{
		"event":             event,
		"notification_type": notifType,
		"success":           success,
	}

	var errorStr string
	if err != nil {
		errorStr = err.Error()
		metadata["error"] = errorStr
		level = "error"
	}

	log := BackendLog{
		ID:        uuid.New(),
		Level:     level,
		Category:  "notification",
		Message:   "Notification: " + event,
		Metadata:  metadata,
		Source:    "backend",
		Component: "notification",
		DriverID:  driverID,
		Error:     errorStr,
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)
}

// LogSystemEvent - Sistem olayı logla
func LogSystemEvent(event string, level string, metadata map[string]interface{}) {
	if dbLogger == nil {
		return
	}

	log := BackendLog{
		ID:        uuid.New(),
		Level:     level,
		Category:  "system",
		Message:   "System: " + event,
		Metadata:  metadata,
		Source:    "backend",
		Component: "system",
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)
}

// LogDBError - Veritabanı hatası logla
func LogDBError(operation string, err error, metadata map[string]interface{}) {
	if dbLogger == nil {
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["operation"] = operation
	metadata["error"] = err.Error()

	log := BackendLog{
		ID:        uuid.New(),
		Level:     "error",
		Category:  "database",
		Message:   "DB Error: " + operation,
		Metadata:  metadata,
		Source:    "backend",
		Component: "database",
		Error:     err.Error(),
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)
}

// LogCritical - Kritik hata logla (hemen flush)
func LogCritical(category, message string, err error, metadata map[string]interface{}) {
	if dbLogger == nil {
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	var errorStr string
	if err != nil {
		errorStr = err.Error()
		metadata["error"] = errorStr
	}

	log := BackendLog{
		ID:        uuid.New(),
		Level:     "critical",
		Category:  category,
		Message:   message,
		Metadata:  metadata,
		Source:    "backend",
		Error:     errorStr,
		Timestamp: time.Now(),
	}

	dbLogger.addLog(log)

	// Kritik hatalar hemen flush
	go dbLogger.Flush()

	// Console'a da yaz
	Log.Error().Err(err).Interface("metadata", metadata).Msg("[CRITICAL] " + message)
}

// StopDBLogger - DB Logger'ı durdur
func StopDBLogger() {
	if dbLogger != nil {
		dbLogger.Stop()
	}
}
