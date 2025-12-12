package service

import (
	"context"
	"log"
	"sync"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

type NotificationService struct {
	fcmClient      *messaging.Client
	fcmCredentials string
	initialized    bool
	initMutex      sync.Once
}

func NewNotificationService(fcmCredentials string) *NotificationService {
	ns := &NotificationService{
		fcmCredentials: fcmCredentials,
	}

	// Firebase'i başlat
	ns.initMutex.Do(func() {
		if fcmCredentials != "" {
			ctx := context.Background()
			opt := option.WithCredentialsFile(fcmCredentials)
			app, err := firebase.NewApp(ctx, nil, opt)
			if err != nil {
				log.Printf("Firebase uygulaması oluşturulamadı: %v", err)
				return
			}

			client, err := app.Messaging(ctx)
			if err != nil {
				log.Printf("Firebase Messaging client oluşturulamadı: %v", err)
				return
			}

			ns.fcmClient = client
			ns.initialized = true
			log.Println("Firebase Cloud Messaging başarıyla başlatıldı")
		} else {
			log.Println("Firebase credentials dosyası belirtilmemiş, bildirimler log'lanacak")
		}
	})

	return ns
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
		log.Printf("FCM token boş, bildirim gönderilemedi")
		return nil
	}

	// Firebase başlatılmadıysa sadece log'la
	if !s.initialized || s.fcmClient == nil {
		log.Printf("[MOCK] Bildirim gönderildi - Token: %s..., Başlık: %s, İçerik: %s",
			token[:min(20, len(token))], message.Title, message.Body)
		return nil
	}

	// Firebase mesajı oluştur
	fcmMessage := &messaging.Message{
		Token: token,
		Notification: &messaging.Notification{
			Title:    message.Title,
			Body:     message.Body,
			ImageURL: message.ImageURL,
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
					Sound:            "default",
					ContentAvailable: true,
				},
			},
		},
	}

	// Mesajı gönder
	response, err := s.fcmClient.Send(ctx, fcmMessage)
	if err != nil {
		log.Printf("FCM bildirim gönderilemedi: %v", err)
		return err
	}

	log.Printf("FCM bildirim gönderildi: %s", response)
	return nil
}

// SendToDevices - Birden fazla cihaza bildirim gönder
func (s *NotificationService) SendToDevices(ctx context.Context, tokens []string, message *NotificationMessage) error {
	if len(tokens) == 0 {
		return nil
	}

	// Firebase başlatılmadıysa sadece log'la
	if !s.initialized || s.fcmClient == nil {
		log.Printf("[MOCK] Toplu bildirim gönderildi - %d cihaz, Başlık: %s", len(tokens), message.Title)
		return nil
	}

	// MulticastMessage oluştur
	fcmMessage := &messaging.MulticastMessage{
		Tokens: tokens,
		Notification: &messaging.Notification{
			Title:    message.Title,
			Body:     message.Body,
			ImageURL: message.ImageURL,
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
					Sound:            "default",
					ContentAvailable: true,
				},
			},
		},
	}

	// Toplu mesaj gönder
	response, err := s.fcmClient.SendEachForMulticast(ctx, fcmMessage)
	if err != nil {
		log.Printf("FCM toplu bildirim gönderilemedi: %v", err)
		return err
	}

	log.Printf("FCM toplu bildirim gönderildi: %d başarılı, %d başarısız",
		response.SuccessCount, response.FailureCount)

	// Başarısız olan token'ları logla
	for i, resp := range response.Responses {
		if resp.Error != nil {
			log.Printf("Token %s için bildirim başarısız: %v", tokens[i][:min(20, len(tokens[i]))], resp.Error)
		}
	}

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
	// Soru metnini kısalt
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

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
