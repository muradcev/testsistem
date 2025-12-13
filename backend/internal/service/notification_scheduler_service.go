package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

// NotificationSchedulerService - Otomatik ve zamanlanmış bildirim servisi
type NotificationSchedulerService struct {
	questionsRepo       *repository.QuestionsRepository
	driverRepo          *repository.DriverRepository
	notificationService *NotificationService
	isRunning           bool
	stopChan            chan struct{}
	mutex               sync.Mutex
}

func NewNotificationSchedulerService(
	questionsRepo *repository.QuestionsRepository,
	driverRepo *repository.DriverRepository,
	notificationService *NotificationService,
) *NotificationSchedulerService {
	return &NotificationSchedulerService{
		questionsRepo:       questionsRepo,
		driverRepo:          driverRepo,
		notificationService: notificationService,
		stopChan:            make(chan struct{}),
	}
}

// Start - Servisi başlat (background goroutine)
func (s *NotificationSchedulerService) Start(checkInterval time.Duration) {
	s.mutex.Lock()
	if s.isRunning {
		s.mutex.Unlock()
		return
	}
	s.isRunning = true
	s.mutex.Unlock()

	go s.run(checkInterval)
	fmt.Println("[SCHEDULER] Bildirim zamanlayıcı servisi başlatıldı")
	os.Stdout.Sync()
}

// Stop - Servisi durdur
func (s *NotificationSchedulerService) Stop() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.isRunning {
		return
	}

	close(s.stopChan)
	s.isRunning = false
	fmt.Println("[SCHEDULER] Bildirim zamanlayıcı servisi durduruldu")
	os.Stdout.Sync()
}

// run - Ana döngü
func (s *NotificationSchedulerService) run(checkInterval time.Duration) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	// İlk çalıştırma
	s.processScheduledNotifications()

	for {
		select {
		case <-ticker.C:
			s.processScheduledNotifications()
		case <-s.stopChan:
			return
		}
	}
}

// processScheduledNotifications - Zamanlanmış bildirimleri işle
func (s *NotificationSchedulerService) processScheduledNotifications() {
	ctx := context.Background()

	// Aktif şablonları al
	templates, err := s.questionsRepo.GetActiveNotificationTemplates(ctx)
	if err != nil {
		log.Printf("Bildirim şablonları alınamadı: %v", err)
		return
	}

	for _, template := range templates {
		if !template.IsActive {
			continue
		}

		// Trigger tipine göre işle
		if template.TriggerType == nil {
			continue
		}

		switch *template.TriggerType {
		case "scheduled":
			s.processScheduledTemplate(ctx, &template)
		case "event":
			s.processEventTemplate(ctx, &template)
		case "daily":
			s.processDailyTemplate(ctx, &template)
		case "weekly":
			s.processWeeklyTemplate(ctx, &template)
		}
	}
}

// processScheduledTemplate - Belirli bir zamanda gönderilecek bildirim
func (s *NotificationSchedulerService) processScheduledTemplate(ctx context.Context, template *models.NotificationTemplate) {
	if template.ScheduledAt == nil {
		return
	}

	now := time.Now()

	// 5 dakikalık tolerans ile kontrol
	diff := template.ScheduledAt.Sub(now)
	if diff < -5*time.Minute || diff > 5*time.Minute {
		return
	}

	// Bu şablon zaten gönderilmiş mi kontrol et
	if template.SentCount > 0 && template.RepeatType == nil {
		return
	}

	s.sendTemplateNotification(ctx, template)
}

// processEventTemplate - Olay bazlı bildirim
func (s *NotificationSchedulerService) processEventTemplate(ctx context.Context, template *models.NotificationTemplate) {
	// Konfigürasyonu parse et
	var config struct {
		EventType string `json:"event_type"` // trip_start, trip_end, idle, new_driver
		Condition string `json:"condition,omitempty"`
	}
	if template.TriggerConfig != nil {
		json.Unmarshal(template.TriggerConfig, &config)
	}

	switch config.EventType {
	case "trip_start":
		// Sefere başlayan şoförlere bildirim
		drivers, _ := s.questionsRepo.GetDriversOnTrip(ctx)
		for _, driver := range drivers {
			// Son 10 dakikada başlamış seferleri al
			if driver.TripDurationMinutes > 10 {
				continue
			}
			s.sendNotificationToDriver(ctx, template, driver.DriverID, map[string]string{
				"driver_name":    driver.Name,
				"start_province": safeString(driver.StartProvince),
			})
		}

	case "trip_end":
		// Seferi bitiren şoförlere bildirim
		drivers, _ := s.questionsRepo.GetDriversWithCompletedTrip(ctx, 1)
		for _, driver := range drivers {
			if driver.HoursSinceCompletion > 1 {
				continue
			}
			s.sendNotificationToDriver(ctx, template, driver.DriverID, map[string]string{
				"driver_name":  driver.Name,
				"from":         safeString(driver.FromProvince),
				"to":           safeString(driver.ToProvince),
				"distance":     formatFloat(driver.DistanceKm),
			})
		}

	case "idle":
		// Bekleyen şoförlere bildirim
		var config2 struct {
			MinIdleHours float64 `json:"min_idle_hours"`
		}
		if template.TriggerConfig != nil {
			json.Unmarshal(template.TriggerConfig, &config2)
		}
		if config2.MinIdleHours == 0 {
			config2.MinIdleHours = 24
		}

		drivers, _ := s.questionsRepo.GetIdleDrivers(ctx, config2.MinIdleHours)
		for _, driver := range drivers {
			s.sendNotificationToDriver(ctx, template, driver.DriverID, map[string]string{
				"driver_name": driver.Name,
				"idle_hours":  formatFloat(driver.IdleHours),
			})
		}
	}
}

// processDailyTemplate - Günlük bildirim
func (s *NotificationSchedulerService) processDailyTemplate(ctx context.Context, template *models.NotificationTemplate) {
	var config struct {
		Hour   int `json:"hour"`
		Minute int `json:"minute"`
	}
	if template.TriggerConfig != nil {
		json.Unmarshal(template.TriggerConfig, &config)
	}

	now := time.Now()
	if now.Hour() != config.Hour {
		return
	}
	if now.Minute() < config.Minute || now.Minute() > config.Minute+5 {
		return
	}

	s.sendTemplateNotification(ctx, template)
}

// processWeeklyTemplate - Haftalık bildirim
func (s *NotificationSchedulerService) processWeeklyTemplate(ctx context.Context, template *models.NotificationTemplate) {
	var config struct {
		DayOfWeek int `json:"day_of_week"` // 0=Pazar
		Hour      int `json:"hour"`
		Minute    int `json:"minute"`
	}
	if template.TriggerConfig != nil {
		json.Unmarshal(template.TriggerConfig, &config)
	}

	now := time.Now()
	if int(now.Weekday()) != config.DayOfWeek {
		return
	}
	if now.Hour() != config.Hour {
		return
	}
	if now.Minute() < config.Minute || now.Minute() > config.Minute+5 {
		return
	}

	s.sendTemplateNotification(ctx, template)
}

// sendTemplateNotification - Şablonu hedef kitleye gönder
func (s *NotificationSchedulerService) sendTemplateNotification(ctx context.Context, template *models.NotificationTemplate) {
	var tokens []string
	var driverData []struct {
		ID   uuid.UUID
		Name string
	}

	// Hedef kitleye göre token'ları al
	switch template.TargetAudience {
	case "all":
		drivers, _ := s.driverRepo.GetDriversWithFCMToken(ctx)
		for _, d := range drivers {
			if d.FCMToken != nil {
				tokens = append(tokens, *d.FCMToken)
				driverData = append(driverData, struct {
					ID   uuid.UUID
					Name string
				}{d.ID, d.Name})
			}
		}

	case "active":
		drivers, _ := s.driverRepo.GetActiveDrivers(ctx)
		for _, d := range drivers {
			if d.FCMToken != nil {
				tokens = append(tokens, *d.FCMToken)
			}
		}

	case "on_trip":
		driversOnTrip, _ := s.questionsRepo.GetDriversOnTrip(ctx)
		for _, d := range driversOnTrip {
			driver, _ := s.driverRepo.GetByID(ctx, d.DriverID)
			if driver != nil && driver.FCMToken != nil {
				tokens = append(tokens, *driver.FCMToken)
			}
		}

	case "at_home":
		drivers, _ := s.questionsRepo.GetIdleDrivers(ctx, 0)
		for _, d := range drivers {
			driver, _ := s.driverRepo.GetByID(ctx, d.DriverID)
			if driver != nil && driver.FCMToken != nil {
				tokens = append(tokens, *driver.FCMToken)
			}
		}

	case "new":
		// Son 7 gün içinde kayıt olanlar
		drivers, _ := s.questionsRepo.GetNewDrivers(ctx, 7)
		for _, d := range drivers {
			if d.FCMToken != nil {
				tokens = append(tokens, *d.FCMToken)
			}
		}
	}

	// İl filtresi varsa uygula
	if len(template.TargetProvinces) > 0 {
		// Filtreleme için yeniden sorgulama gerekebilir
		// Bu basit implementasyon için şimdilik tüm token'lara gönderiyoruz
	}

	if len(tokens) == 0 {
		log.Printf("Bildirim gönderilecek hedef yok: %s", template.Name)
		return
	}

	// Bildirimi gönder
	message := &NotificationMessage{
		Title: template.Title,
		Body:  template.Body,
		Data: map[string]string{
			"type":        "template",
			"template_id": template.ID.String(),
			"category":    template.Category,
		},
	}

	err := s.notificationService.SendToDevices(ctx, tokens, message)
	if err != nil {
		log.Printf("Şablon bildirimi gönderilemedi: %v", err)
		return
	}

	// Gönderim sayısını güncelle
	s.questionsRepo.IncrementNotificationSentCount(ctx, template.ID, len(tokens))

	fmt.Printf("[SCHEDULER] Şablon bildirimi gönderildi: %s, %d alıcı\n", template.Name, len(tokens))
	os.Stdout.Sync()
}

// sendNotificationToDriver - Tek bir şoföre bildirim gönder
func (s *NotificationSchedulerService) sendNotificationToDriver(
	ctx context.Context,
	template *models.NotificationTemplate,
	driverID uuid.UUID,
	variables map[string]string,
) {
	driver, err := s.driverRepo.GetByID(ctx, driverID)
	if err != nil || driver == nil || driver.FCMToken == nil {
		return
	}

	// Şablon değişkenlerini değiştir
	title := s.replaceVariables(template.Title, variables)
	body := s.replaceVariables(template.Body, variables)

	message := &NotificationMessage{
		Title: title,
		Body:  body,
		Data: map[string]string{
			"type":        "template",
			"template_id": template.ID.String(),
			"category":    template.Category,
		},
	}

	err = s.notificationService.SendToDevice(ctx, *driver.FCMToken, message)
	if err != nil {
		log.Printf("Bildirim gönderilemedi: %v", err)
		return
	}

	// Gönderim sayısını güncelle
	s.questionsRepo.IncrementNotificationSentCount(ctx, template.ID, 1)
}

// replaceVariables - Şablon değişkenlerini değiştir
func (s *NotificationSchedulerService) replaceVariables(text string, variables map[string]string) string {
	result := text
	for key, value := range variables {
		result = strings.ReplaceAll(result, "{{"+key+"}}", value)
	}
	return result
}

// SendManualNotification - Manuel bildirim gönderimi (API'den çağrılır)
func (s *NotificationSchedulerService) SendManualNotification(
	ctx context.Context,
	templateID uuid.UUID,
	driverIDs []uuid.UUID,
) (int, error) {
	template, err := s.questionsRepo.GetNotificationTemplateByID(ctx, templateID)
	if err != nil {
		return 0, err
	}

	sentCount := 0
	for _, driverID := range driverIDs {
		driver, err := s.driverRepo.GetByID(ctx, driverID)
		if err != nil || driver == nil || driver.FCMToken == nil {
			continue
		}

		variables := map[string]string{
			"driver_name": driver.Name + " " + driver.Surname,
			"province":    driver.Province,
		}

		s.sendNotificationToDriver(ctx, template, driverID, variables)
		sentCount++
	}

	return sentCount, nil
}

// Helper functions
func safeString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func safeStringPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func formatFloat(f *float64) string {
	if f == nil {
		return "0"
	}
	// Basit formatlama: 2 ondalık basamak, sonra sıfırları temizle
	s := strings.TrimRight(strings.TrimRight(
		strings.Replace(
			fmt.Sprintf("%.2f", *f),
			".", ",", 1,
		),
		"0"), ",")
	if s == "" {
		return "0"
	}
	return s
}
