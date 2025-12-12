package service

import (
	"context"
	"log"
)

type NotificationService struct {
	initialized bool
}

func NewNotificationService(fcmCredentials string) *NotificationService {
	log.Println("Bildirim servisi başlatıldı (mock mod - Firebase devre dışı)")
	return &NotificationService{
		initialized: false,
	}
}

type NotificationMessage struct {
	Title    string            `json:"title"`
	Body     string            `json:"body"`
	Data     map[string]string `json:"data,omitempty"`
	ImageURL string            `json:"image_url,omitempty"`
}

// SendToDevice - Tek bir cihaza bildirim gönder
func (s *NotificationService) SendToDevice(ctx context.Context, token string, message *NotificationMessage) error {
	if token == "" {
		return nil
	}
	log.Printf("[MOCK] Bildirim gönderildi - Token: %s..., Başlık: %s, İçerik: %s",
		token[:min(20, len(token))], message.Title, message.Body)
	return nil
}

// SendToDevices - Birden fazla cihaza bildirim gönder
func (s *NotificationService) SendToDevices(ctx context.Context, tokens []string, message *NotificationMessage) error {
	if len(tokens) == 0 {
		return nil
	}
	log.Printf("[MOCK] Toplu bildirim gönderildi - %d cihaz, Başlık: %s", len(tokens), message.Title)
	return nil
}

// SendSurveyNotification - Anket bildirimi gönder
func (s *NotificationService) SendSurveyNotification(ctx context.Context, token string, surveyTitle string) error {
	message := &NotificationMessage{
		Title: "Yeni Anket",
		Body:  surveyTitle,
		Data: map[string]string{
			"type":   "survey",
			"action": "open_survey",
		},
	}
	return s.SendToDevice(ctx, token, message)
}

// SendQuestionNotification - Soru bildirimi gönder
func (s *NotificationService) SendQuestionNotification(ctx context.Context, token string, questionID string, questionText string) error {
	body := questionText
	if len(body) > 100 {
		body = body[:97] + "..."
	}
	message := &NotificationMessage{
		Title: "Yeni Soru",
		Body:  body,
		Data: map[string]string{
			"type":        "question",
			"action":      "open_question",
			"question_id": questionID,
		},
	}
	return s.SendToDevice(ctx, token, message)
}

// SendTripReminderNotification - Sefer hatırlatma bildirimi
func (s *NotificationService) SendTripReminderNotification(ctx context.Context, token string, message string) error {
	notification := &NotificationMessage{
		Title: "Sefer Hatırlatma",
		Body:  message,
		Data: map[string]string{
			"type":   "trip_reminder",
			"action": "open_trips",
		},
	}
	return s.SendToDevice(ctx, token, notification)
}

// SendPriceUpdateNotification - Fiyat güncelleme bildirimi
func (s *NotificationService) SendPriceUpdateNotification(ctx context.Context, token string, route string, newPrice string) error {
	message := &NotificationMessage{
		Title: "Fiyat Güncellemesi",
		Body:  route + " güzergahında yeni fiyatlar: " + newPrice,
		Data: map[string]string{
			"type":   "price_update",
			"action": "open_prices",
		},
	}
	return s.SendToDevice(ctx, token, message)
}

// SendBroadcastNotification - Genel duyuru bildirimi
func (s *NotificationService) SendBroadcastNotification(ctx context.Context, tokens []string, title string, body string, category string) error {
	message := &NotificationMessage{
		Title: title,
		Body:  body,
		Data: map[string]string{
			"type":     "broadcast",
			"category": category,
			"action":   "open_notifications",
		},
	}
	return s.SendToDevices(ctx, tokens, message)
}

// IsInitialized - Firebase'in başlatılıp başlatılmadığını kontrol et
func (s *NotificationService) IsInitialized() bool {
	return s.initialized
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
