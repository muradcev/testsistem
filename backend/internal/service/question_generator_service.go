package service

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
)

// QuestionGeneratorService - Otomatik soru üretme servisi
type QuestionGeneratorService struct {
	questionsRepo       *repository.QuestionsRepository
	driverRepo          *repository.DriverRepository
	notificationService *NotificationService
	isRunning           bool
	stopChan            chan struct{}
	mutex               sync.Mutex
}

func NewQuestionGeneratorService(
	questionsRepo *repository.QuestionsRepository,
	driverRepo *repository.DriverRepository,
	notificationService *NotificationService,
) *QuestionGeneratorService {
	return &QuestionGeneratorService{
		questionsRepo:       questionsRepo,
		driverRepo:          driverRepo,
		notificationService: notificationService,
		stopChan:            make(chan struct{}),
	}
}

// Start - Servisi başlat (background goroutine)
func (s *QuestionGeneratorService) Start(checkInterval time.Duration) {
	s.mutex.Lock()
	if s.isRunning {
		s.mutex.Unlock()
		return
	}
	s.isRunning = true
	s.mutex.Unlock()

	go s.run(checkInterval)
	log.Println("Otomatik soru üretme servisi başlatıldı")
}

// Stop - Servisi durdur
func (s *QuestionGeneratorService) Stop() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.isRunning {
		return
	}

	close(s.stopChan)
	s.isRunning = false
	log.Println("Otomatik soru üretme servisi durduruldu")
}

// run - Ana döngü
func (s *QuestionGeneratorService) run(checkInterval time.Duration) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	// İlk çalıştırma
	s.checkAndGenerateQuestions()

	for {
		select {
		case <-ticker.C:
			s.checkAndGenerateQuestions()
		case <-s.stopChan:
			return
		}
	}
}

// checkAndGenerateQuestions - Aktif kuralları kontrol et ve soru üret
func (s *QuestionGeneratorService) checkAndGenerateQuestions() {
	ctx := context.Background()

	// Aktif kuralları al
	rules, err := s.questionsRepo.GetAllRules(ctx)
	if err != nil {
		log.Printf("Kurallar alınamadı: %v", err)
		return
	}

	for _, rule := range rules {
		if !rule.IsActive {
			continue
		}

		switch rule.TriggerCondition {
		case "trip_start":
			s.processTripsStartRule(ctx, &rule)
		case "trip_end":
			s.processTripsEndRule(ctx, &rule)
		case "idle_driver":
			s.processIdleDriverRule(ctx, &rule)
		case "location_based":
			s.processLocationBasedRule(ctx, &rule)
		case "scheduled":
			s.processScheduledRule(ctx, &rule)
		}
	}
}

// processTripsStartRule - Sefer başlangıcı kuralı
func (s *QuestionGeneratorService) processTripsStartRule(ctx context.Context, rule *models.QuestionRule) {
	drivers, err := s.questionsRepo.GetDriversOnTrip(ctx)
	if err != nil {
		return
	}

	// Konfigürasyonu parse et
	var config struct {
		MinTripDurationMinutes int `json:"min_trip_duration_minutes"`
	}
	if rule.ConditionConfig != nil {
		json.Unmarshal(rule.ConditionConfig, &config)
	}

	for _, driver := range drivers {
		// Sefer süresini kontrol et
		if config.MinTripDurationMinutes > 0 && driver.TripDurationMinutes < float64(config.MinTripDurationMinutes) {
			continue
		}

		// Cooldown kontrolü
		hasRecent, _ := s.questionsRepo.CheckRecentQuestion(ctx, driver.DriverID, rule.ID, rule.CooldownHours)
		if hasRecent {
			continue
		}

		// Soru oluştur
		s.generateQuestionFromRule(ctx, rule, driver.DriverID, &driver.TripID, map[string]interface{}{
			"trigger":         "trip_start",
			"trip_id":         driver.TripID.String(),
			"start_province":  driver.StartProvince,
			"distance_km":     driver.DistanceKm,
			"duration_minutes": driver.TripDurationMinutes,
		})
	}
}

// processTripsEndRule - Sefer bitişi kuralı
func (s *QuestionGeneratorService) processTripsEndRule(ctx context.Context, rule *models.QuestionRule) {
	// Konfigürasyonu parse et
	var config struct {
		MaxHoursAfterEnd int `json:"max_hours_after_end"`
	}
	if rule.ConditionConfig != nil {
		json.Unmarshal(rule.ConditionConfig, &config)
	}
	if config.MaxHoursAfterEnd == 0 {
		config.MaxHoursAfterEnd = 24 // Varsayılan 24 saat
	}

	drivers, err := s.questionsRepo.GetDriversWithCompletedTrip(ctx, config.MaxHoursAfterEnd)
	if err != nil {
		return
	}

	for _, driver := range drivers {
		// Cooldown kontrolü
		hasRecent, _ := s.questionsRepo.CheckRecentQuestion(ctx, driver.DriverID, rule.ID, rule.CooldownHours)
		if hasRecent {
			continue
		}

		// Soru oluştur
		s.generateQuestionFromRule(ctx, rule, driver.DriverID, &driver.TripID, map[string]interface{}{
			"trigger":                 "trip_end",
			"trip_id":                 driver.TripID.String(),
			"from_province":           driver.FromProvince,
			"to_province":             driver.ToProvince,
			"distance_km":             driver.DistanceKm,
			"hours_since_completion":  driver.HoursSinceCompletion,
		})
	}
}

// processIdleDriverRule - Bekleyen şoför kuralı
func (s *QuestionGeneratorService) processIdleDriverRule(ctx context.Context, rule *models.QuestionRule) {
	// Konfigürasyonu parse et
	var config struct {
		MinIdleHours float64 `json:"min_idle_hours"`
	}
	if rule.ConditionConfig != nil {
		json.Unmarshal(rule.ConditionConfig, &config)
	}
	if config.MinIdleHours == 0 {
		config.MinIdleHours = 2 // Varsayılan 2 saat
	}

	drivers, err := s.questionsRepo.GetIdleDrivers(ctx, config.MinIdleHours)
	if err != nil {
		return
	}

	for _, driver := range drivers {
		// Cooldown kontrolü
		hasRecent, _ := s.questionsRepo.CheckRecentQuestion(ctx, driver.DriverID, rule.ID, rule.CooldownHours)
		if hasRecent {
			continue
		}

		// Soru oluştur
		s.generateQuestionFromRule(ctx, rule, driver.DriverID, nil, map[string]interface{}{
			"trigger":      "idle_driver",
			"idle_hours":   driver.IdleHours,
			"home_province": driver.HomeProvince,
		})
	}
}

// processLocationBasedRule - Lokasyon bazlı kural
func (s *QuestionGeneratorService) processLocationBasedRule(ctx context.Context, rule *models.QuestionRule) {
	// Konfigürasyonu parse et
	var config struct {
		Province string `json:"province"`
		District string `json:"district,omitempty"`
	}
	if rule.ConditionConfig != nil {
		json.Unmarshal(rule.ConditionConfig, &config)
	}

	if config.Province == "" {
		return
	}

	drivers, err := s.questionsRepo.GetDriversByProvince(ctx, config.Province)
	if err != nil {
		return
	}

	for _, driver := range drivers {
		// Cooldown kontrolü
		hasRecent, _ := s.questionsRepo.CheckRecentQuestion(ctx, driver.DriverID, rule.ID, rule.CooldownHours)
		if hasRecent {
			continue
		}

		// Soru oluştur
		s.generateQuestionFromRule(ctx, rule, driver.DriverID, nil, map[string]interface{}{
			"trigger":  "location_based",
			"province": config.Province,
		})
	}
}

// processScheduledRule - Zamanlanmış kural
func (s *QuestionGeneratorService) processScheduledRule(ctx context.Context, rule *models.QuestionRule) {
	// Konfigürasyonu parse et
	var config struct {
		ScheduleHour   int      `json:"schedule_hour"`   // 0-23
		ScheduleMinute int      `json:"schedule_minute"` // 0-59
		DaysOfWeek     []int    `json:"days_of_week"`    // 0=Pazar, 1=Pazartesi, ...
		TargetGroup    string   `json:"target_group"`    // all, on_trip, idle
		Provinces      []string `json:"provinces,omitempty"`
	}
	if rule.ConditionConfig != nil {
		json.Unmarshal(rule.ConditionConfig, &config)
	}

	// Şu anki zamanı kontrol et
	now := time.Now()
	currentHour := now.Hour()
	currentMinute := now.Minute()
	currentDay := int(now.Weekday())

	// Saat ve gün kontrolü (5 dakikalık tolerans)
	if currentHour != config.ScheduleHour {
		return
	}
	if currentMinute < config.ScheduleMinute || currentMinute > config.ScheduleMinute+5 {
		return
	}
	if len(config.DaysOfWeek) > 0 {
		dayMatch := false
		for _, day := range config.DaysOfWeek {
			if day == currentDay {
				dayMatch = true
				break
			}
		}
		if !dayMatch {
			return
		}
	}

	// Hedef gruba göre şoförleri al
	var driverIDs []uuid.UUID

	switch config.TargetGroup {
	case "on_trip":
		drivers, err := s.questionsRepo.GetDriversOnTrip(ctx)
		if err != nil {
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	case "idle":
		drivers, err := s.questionsRepo.GetIdleDrivers(ctx, 0)
		if err != nil {
			return
		}
		for _, d := range drivers {
			driverIDs = append(driverIDs, d.DriverID)
		}
	default: // "all" veya belirtilmemiş
		drivers, err := s.questionsRepo.GetAllActiveDrivers(ctx)
		if err != nil {
			return
		}
		for _, d := range drivers {
			// İl filtresi varsa uygula
			if len(config.Provinces) > 0 && d.Province != nil {
				provinceMatch := false
				for _, p := range config.Provinces {
					if p == *d.Province {
						provinceMatch = true
						break
					}
				}
				if !provinceMatch {
					continue
				}
			}
			driverIDs = append(driverIDs, d.DriverID)
		}
	}

	// Her şoför için soru oluştur
	for _, driverID := range driverIDs {
		// Cooldown kontrolü
		hasRecent, _ := s.questionsRepo.CheckRecentQuestion(ctx, driverID, rule.ID, rule.CooldownHours)
		if hasRecent {
			continue
		}

		s.generateQuestionFromRule(ctx, rule, driverID, nil, map[string]interface{}{
			"trigger":       "scheduled",
			"schedule_hour": config.ScheduleHour,
		})
	}
}

// generateQuestionFromRule - Kuraldan soru oluştur
func (s *QuestionGeneratorService) generateQuestionFromRule(
	ctx context.Context,
	rule *models.QuestionRule,
	driverID uuid.UUID,
	tripID *uuid.UUID,
	contextData map[string]interface{},
) {
	// Context data'ya kural bilgisi ekle
	contextData["rule_id"] = rule.ID.String()
	contextData["rule_name"] = rule.Name

	contextJSON, _ := json.Marshal(contextData)

	// Durumu belirle
	status := "pending_approval"
	if !rule.RequiresApproval {
		status = "approved"
	}

	// Soruyu oluştur
	question := &models.DriverQuestion{
		DriverID:          driverID,
		QuestionText:      rule.QuestionTemplate,
		QuestionType:      rule.QuestionType,
		Options:           rule.OptionsTemplate,
		FollowUpQuestions: rule.FollowUpTemplate,
		SourceType:        "auto_rule",
		Status:            status,
		ContextType:       rule.TriggerCondition,
		ContextData:       contextJSON,
		RelatedTripID:     tripID,
		Priority:          rule.Priority,
	}

	if err := s.questionsRepo.CreateQuestion(ctx, question); err != nil {
		log.Printf("Otomatik soru oluşturulamadı: %v", err)
		return
	}

	// Log kaydı
	wasApproved := !rule.RequiresApproval
	s.questionsRepo.LogQuestionGeneration(ctx, &rule.ID, &driverID, &question.ID, "auto_rule", rule.TriggerCondition, &wasApproved)

	// Onay gerekmiyorsa hemen gönder
	if !rule.RequiresApproval {
		s.sendQuestionNotification(ctx, driverID, question)
	}

	log.Printf("Otomatik soru oluşturuldu: Kural=%s, Şoför=%s, Soru=%s",
		rule.Name, driverID.String(), question.ID.String())
}

// sendQuestionNotification - Soru bildirimini gönder
func (s *QuestionGeneratorService) sendQuestionNotification(ctx context.Context, driverID uuid.UUID, question *models.DriverQuestion) {
	if s.driverRepo == nil || s.notificationService == nil {
		return
	}

	driver, err := s.driverRepo.GetByID(ctx, driverID)
	if err != nil || driver == nil || driver.FCMToken == nil || *driver.FCMToken == "" {
		return
	}

	go func() {
		_ = s.notificationService.SendQuestionNotification(
			ctx,
			*driver.FCMToken,
			question.ID.String(),
			question.QuestionText,
		)
	}()

	// Soruyu gönderildi olarak işaretle
	s.questionsRepo.MarkQuestionSent(ctx, question.ID, nil)
}

// ManualTrigger - Manuel tetikleme (admin tarafından)
func (s *QuestionGeneratorService) ManualTrigger(ctx context.Context, ruleID uuid.UUID) error {
	rule, err := s.questionsRepo.GetRuleByID(ctx, ruleID)
	if err != nil {
		return err
	}

	switch rule.TriggerCondition {
	case "trip_start":
		s.processTripsStartRule(ctx, rule)
	case "trip_end":
		s.processTripsEndRule(ctx, rule)
	case "idle_driver":
		s.processIdleDriverRule(ctx, rule)
	case "location_based":
		s.processLocationBasedRule(ctx, rule)
	case "scheduled":
		s.processScheduledRule(ctx, rule)
	}

	return nil
}
