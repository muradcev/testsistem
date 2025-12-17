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

// SendQuestionNotification - Soru bildirimi gönder (DATA-ONLY - her zaman arka planda çalışır)
func (s *NotificationService) SendQuestionNotification(ctx context.Context, token string, questionID string, questionText string) error {
	if token == "" {
		return nil
	}

	body := questionText
	if len(body) > 100 {
		body = body[:97] + "..."
	}

	if !s.initialized || s.client == nil {
		log.Printf("[MOCK] Soru bildirimi gönderildi - Token: %s..., QuestionID: %s",
			token[:min(20, len(token))], questionID)
		return nil
	}

	// DATA-ONLY mesaj gönder - bu her zaman arka plan handler'ı tetikler
	// Notification payload YOK - Flutter uygulaması local notification gösterecek
	fcmMessage := &messaging.Message{
		Token: token,
		Data: map[string]string{
			"type":          "question",
			"action":        "open_question",
			"question_id":   questionID,
			"question_text": body,
			"title":         "Yeni Soru",
		},
		Android: &messaging.AndroidConfig{
			Priority: "high",
			// TTL sıfır - anında teslim et
			TTL: nil,
		},
		APNS: &messaging.APNSConfig{
			Headers: map[string]string{
				"apns-priority": "10",
				"apns-push-type": "background",
			},
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					ContentAvailable: true,
					MutableContent:   true,
				},
			},
		},
	}

	response, err := s.client.Send(ctx, fcmMessage)
	if err != nil {
		log.Printf("[FCM] Soru bildirimi gönderilemedi - Token: %s..., Hata: %v", token[:min(20, len(token))], err)
		return err
	}

	log.Printf("[FCM] Soru bildirimi gönderildi (data-only) - Response: %s, QuestionID: %s", response, questionID)
	return nil
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

// SendLocationRequest - Şoförden anlık konum isteği gönder (sessiz bildirim)
func (s *NotificationService) SendLocationRequest(ctx context.Context, token string, requestID string) error {
	if token == "" {
		return nil
	}

	if !s.initialized || s.client == nil {
		log.Printf("[MOCK] Konum isteği gönderildi - Token: %s..., RequestID: %s",
			token[:min(20, len(token))], requestID)
		return nil
	}

	// Data-only mesaj gönder (sessiz, kullanıcı görmez)
	fcmMessage := &messaging.Message{
		Token: token,
		Data: map[string]string{
			"type":       "location_request",
			"request_id": requestID,
			"action":     "send_location",
		},
		Android: &messaging.AndroidConfig{
			Priority: "high",
		},
		APNS: &messaging.APNSConfig{
			Headers: map[string]string{
				"apns-priority": "10",
			},
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					ContentAvailable: true,
				},
			},
		},
	}

	response, err := s.client.Send(ctx, fcmMessage)
	if err != nil {
		log.Printf("Konum isteği gönderilemedi - Token: %s..., Hata: %v", token[:min(20, len(token))], err)
		return err
	}

	log.Printf("Konum isteği gönderildi - Response: %s, RequestID: %s", response, requestID)
	return nil
}

// IsInitialized - Firebase'in başlatılıp başlatılmadığını kontrol et
func (s *NotificationService) IsInitialized() bool {
	return s.initialized
}

// TokenValidationResult - Token doğrulama sonucu
type TokenValidationResult struct {
	Token       string `json:"token"`
	Valid       bool   `json:"valid"`
	Error       string `json:"error,omitempty"`
	Uninstalled bool   `json:"uninstalled"` // true ise uygulama kesin silinmiş
}

// ValidateToken - Tek bir FCM token'ın geçerli olup olmadığını kontrol et
// Görünmez bir data mesajı göndererek token'ın hala geçerli olup olmadığını test eder
func (s *NotificationService) ValidateToken(ctx context.Context, token string) *TokenValidationResult {
	result := &TokenValidationResult{Token: token, Valid: true}

	if token == "" {
		result.Valid = false
		result.Error = "empty_token"
		return result
	}

	if !s.initialized || s.client == nil {
		// Firebase başlatılmamışsa test edemiyoruz
		result.Error = "firebase_not_initialized"
		return result
	}

	// Görünmez data-only mesaj gönder (kullanıcı görmez)
	message := &messaging.Message{
		Token: token,
		Data: map[string]string{
			"type":      "token_validation",
			"timestamp": fmt.Sprintf("%d", ctx.Value("timestamp")),
		},
		// Android'de data-only mesaj bildirimi göstermez
		Android: &messaging.AndroidConfig{
			Priority: "normal",
		},
	}

	_, err := s.client.Send(ctx, message)
	if err != nil {
		result.Valid = false
		result.Error = err.Error()

		// FCM hata mesajlarını kontrol et
		errStr := err.Error()
		if contains(errStr, "NotRegistered") ||
			contains(errStr, "not registered") ||
			contains(errStr, "InvalidRegistration") ||
			contains(errStr, "invalid registration") ||
			contains(errStr, "Requested entity was not found") {
			result.Uninstalled = true
			result.Error = "app_uninstalled"
		}
	}

	return result
}

// ValidateTokens - Birden fazla FCM token'ı doğrula ve geçersiz olanları döndür
func (s *NotificationService) ValidateTokens(ctx context.Context, tokens []string) ([]TokenValidationResult, error) {
	results := make([]TokenValidationResult, 0, len(tokens))

	if len(tokens) == 0 {
		return results, nil
	}

	if !s.initialized || s.client == nil {
		// Firebase başlatılmamışsa tüm tokenları "bilinmiyor" olarak işaretle
		for _, token := range tokens {
			results = append(results, TokenValidationResult{
				Token: token,
				Valid: true,
				Error: "firebase_not_initialized",
			})
		}
		return results, nil
	}

	// Görünmez multicast mesaj gönder
	message := &messaging.MulticastMessage{
		Tokens: tokens,
		Data: map[string]string{
			"type":      "token_validation",
			"timestamp": fmt.Sprintf("%d", ctx.Value("timestamp")),
		},
		Android: &messaging.AndroidConfig{
			Priority: "normal",
		},
	}

	response, err := s.client.SendEachForMulticast(ctx, message)
	if err != nil {
		return nil, fmt.Errorf("multicast send failed: %w", err)
	}

	// Her token için sonucu değerlendir
	for i, resp := range response.Responses {
		result := TokenValidationResult{
			Token: tokens[i],
			Valid: resp.Success,
		}

		if !resp.Success && resp.Error != nil {
			result.Error = resp.Error.Error()
			errStr := resp.Error.Error()

			// Uygulama silinmiş mi kontrol et
			if contains(errStr, "NotRegistered") ||
				contains(errStr, "not registered") ||
				contains(errStr, "InvalidRegistration") ||
				contains(errStr, "invalid registration") ||
				contains(errStr, "Requested entity was not found") {
				result.Uninstalled = true
				result.Error = "app_uninstalled"
			}
		}

		results = append(results, result)
	}

	log.Printf("[FCM] Token validation completed - Total: %d, Success: %d, Failed: %d",
		len(tokens), response.SuccessCount, response.FailureCount)

	return results, nil
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsRune(s, substr))
}

func containsRune(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
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
