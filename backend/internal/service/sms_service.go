package service

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
)

type SMSService struct {
	userCode  string
	password  string
	msgHeader string
}

func NewSMSService(userCode, password, msgHeader string) *SMSService {
	return &SMSService{
		userCode:  userCode,
		password:  password,
		msgHeader: msgHeader,
	}
}

func (s *SMSService) SendOTP(phone, code string) error {
	if s.userCode == "" || s.password == "" {
		log.Printf("SMS service not configured. OTP for %s: %s", phone, code)
		return nil
	}

	message := fmt.Sprintf("Nakliyeo dogrulama kodunuz: %s", code)
	return s.sendSMS(phone, message)
}

func (s *SMSService) sendSMS(phone, message string) error {
	baseURL := "https://api.netgsm.com.tr/sms/send/get"

	params := url.Values{}
	params.Add("usercode", s.userCode)
	params.Add("password", s.password)
	params.Add("gsmno", phone)
	params.Add("message", message)
	params.Add("msgheader", s.msgHeader)

	resp, err := http.Get(baseURL + "?" + params.Encode())
	if err != nil {
		return fmt.Errorf("SMS gönderimi başarısız: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("SMS yanıtı okunamadı: %w", err)
	}
	log.Printf("Netgsm response: %s", string(body))

	// Netgsm yanıt kodlarını kontrol et
	// 00, 01, 02 başarılı
	if len(body) < 2 {
		return fmt.Errorf("SMS geçersiz yanıt: %s", string(body))
	}
	responseCode := string(body[:2])
	if responseCode != "00" && responseCode != "01" && responseCode != "02" {
		return fmt.Errorf("SMS gönderimi başarısız: %s", string(body))
	}

	return nil
}

func (s *SMSService) IsConfigured() bool {
	return s.userCode != "" && s.password != "" && s.msgHeader != ""
}
