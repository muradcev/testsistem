package service

import (
	"context"
	"fmt"
	"log"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

type NotificationService struct {
	client      *messaging.Client
	initialized bool
}

func NewNotificationService(credentialsJSON string) *NotificationService {
	fmt.Println("=== Firebase Notification Service Başlatılıyor ===")
	os.Stdout.Sync()

	if credentialsJSON == "" {
		fmt.Println("[FIREBASE] Credentials belirtilmedi - bildirim servisi devre dışı")
		os.Stdout.Sync()
		return &NotificationService{initialized: false}
	}

	fmt.Printf("[FIREBASE] Credentials uzunluğu: %d karakter\n", len(credentialsJSON))
	os.Stdout.Sync()

	ctx := context.Background()

	// JSON string olarak gelen credentials'ı kullan
	opt := option.WithCredentialsJSON([]byte(credentialsJSON))

	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		fmt.Printf("[FIREBASE] Uygulama başlatılamadı: %v\n", err)
		os.Stdout.Sync()
		return &NotificationService{initialized: false}
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		fmt.Printf("[FIREBASE] Messaging client oluşturulamadı: %v\n", err)
		os.Stdout.Sync()
		return &NotificationService{initialized: false}
	}

	fmt.Println("[FIREBASE] ✓ Bildirim servisi başarıyla başlatıldı!")
	os.Stdout.Sync()
	log.Println("Firebase bildirim servisi başarıyla başlatıldı")

	return &NotificationService{
		client:      client,
		initialized: true,
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

	if !s.initialized || s.client == nil {
		log.Printf("[MOCK] Bildirim gönderildi - Token: %s..., Başlık: %s, İçerik: %s",
			token[:min(20, len(token))], message.Title, message.Body)
		return nil
	}

	fcmMessage := &messaging.Message{
		Token: token,
		Notification: &messaging.Notification{
			Title: message.Title,
			Body:  message.Body,
		},
		Data: message.Data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				Sound:       "default",
				ClickAction: "FLUTTER_NOTIFICATION_CLICK",
			},
		},
		APNS: &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Sound: "default",
					Badge: intPtr(1),
				},
			},
		},
	}

	if message.ImageURL != "" {
		fcmMessage.Notification.ImageURL = message.ImageURL
	}

	response, err := s.client.Send(ctx, fcmMessage)
	if err != nil {
		log.Printf("Bildirim gönderilemedi - Token: %s..., Hata: %v", token[:min(20, len(token))], err)
		return err
	}

	log.Printf("Bildirim gönderildi - Response: %s, Başlık: %s", response, message.Title)
	return nil
}

// SendToDevices - Birden fazla cihaza bildirim gönder
func (s *NotificationService) SendToDevices(ctx context.Context, tokens []string, message *NotificationMessage) error {
	if len(tokens) == 0 {
		return nil
	}

	if !s.initialized || s.client == nil {
		log.Printf("[MOCK] Toplu bildirim gönderildi - %d cihaz, Başlık: %s", len(tokens), message.Title)
		return nil
	}

	// FCM v1 API'de multicast mesaj gönderimi
	fcmMessage := &messaging.MulticastMessage{
		Tokens: tokens,
		Notification: &messaging.Notification{
			Title: message.Title,
			Body:  message.Body,
		},
		Data: message.Data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				Sound:       "default",
				ClickAction: "FLUTTER_NOTIFICATION_CLICK",
			},
		},
		APNS: &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Sound: "default",
					Badge: intPtr(1),
				},
			},
		},
	}

	if message.ImageURL != "" {
		fcmMessage.Notification.ImageURL = message.ImageURL
	}

	response, err := s.client.SendEachForMulticast(ctx, fcmMessage)
	if err != nil {
		log.Printf("Toplu bildirim gönderilemedi - Hata: %v", err)
		return err
	}

	log.Printf("Toplu bildirim gönderildi - Başarılı: %d, Başarısız: %d, Başlık: %s",
		response.SuccessCount, response.FailureCount, message.Title)
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

func intPtr(i int) *int {
	return &i
}
