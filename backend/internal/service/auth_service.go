package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	driverRepo   *repository.DriverRepository
	adminRepo    *repository.AdminRepository
	settingsRepo *repository.SettingsRepository
	otpStore     map[string]*models.OTPRecord
	otpMutex     sync.RWMutex
}

func NewAuthService(driverRepo *repository.DriverRepository, adminRepo *repository.AdminRepository, settingsRepo *repository.SettingsRepository) *AuthService {
	return &AuthService{
		driverRepo:   driverRepo,
		adminRepo:    adminRepo,
		settingsRepo: settingsRepo,
		otpStore:     make(map[string]*models.OTPRecord),
	}
}

func (s *AuthService) RegisterDriver(ctx context.Context, req *models.DriverRegisterRequest) (*models.Driver, error) {
	// Telefon numarası kontrolü
	existing, err := s.driverRepo.GetByPhone(ctx, req.Phone)
	if err != nil {
		return nil, fmt.Errorf("telefon kontrolü yapılamadı: %w", err)
	}
	if existing != nil {
		return nil, errors.New("bu telefon numarası zaten kayıtlı")
	}

	// Şifre hash'le
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("şifre oluşturulamadı: %w", err)
	}

	driver := &models.Driver{
		Phone:        req.Phone,
		Name:         req.Name,
		Surname:      req.Surname,
		PasswordHash: string(hashedPassword),
		Province:     req.Province,
		District:     req.District,
		Neighborhood: req.Neighborhood,
	}

	if err := s.driverRepo.Create(ctx, driver); err != nil {
		return nil, fmt.Errorf("kayıt oluşturulamadı: %w", err)
	}

	return driver, nil
}

func (s *AuthService) LoginDriver(ctx context.Context, req *models.DriverLoginRequest) (*models.Driver, *models.AuthResponse, error) {
	driver, err := s.driverRepo.GetByPhone(ctx, req.Phone)
	if err != nil {
		return nil, nil, fmt.Errorf("giriş yapılamadı: %w", err)
	}
	if driver == nil {
		return nil, nil, errors.New("telefon numarası veya şifre hatalı")
	}

	if !driver.IsActive {
		return nil, nil, errors.New("hesabınız aktif değil")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(driver.PasswordHash), []byte(req.Password)); err != nil {
		return nil, nil, errors.New("telefon numarası veya şifre hatalı")
	}

	// SMS doğrulama kontrolü
	smsEnabled, _ := s.IsSMSVerificationEnabled(ctx)
	if smsEnabled && !driver.IsPhoneVerified {
		return nil, nil, errors.New("lütfen önce telefon numaranızı doğrulayın")
	}

	// Token oluştur
	authResponse, err := s.generateDriverTokens(driver)
	if err != nil {
		return nil, nil, fmt.Errorf("token oluşturulamadı: %w", err)
	}

	return driver, authResponse, nil
}

func (s *AuthService) LoginAdmin(ctx context.Context, req *models.AdminLoginRequest) (*models.AdminUser, *models.AuthResponse, error) {
	admin, err := s.adminRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, nil, fmt.Errorf("giriş yapılamadı: %w", err)
	}
	if admin == nil {
		return nil, nil, errors.New("email veya şifre hatalı")
	}

	if !admin.IsActive {
		return nil, nil, errors.New("hesabınız aktif değil")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		return nil, nil, errors.New("email veya şifre hatalı")
	}

	// Token oluştur
	authResponse, err := s.generateAdminTokens(admin)
	if err != nil {
		return nil, nil, fmt.Errorf("token oluşturulamadı: %w", err)
	}

	return admin, authResponse, nil
}

func (s *AuthService) GenerateOTP(ctx context.Context, phone string) (string, error) {
	s.otpMutex.Lock()
	defer s.otpMutex.Unlock()

	// Mevcut OTP'yi kontrol et
	if existing, ok := s.otpStore[phone]; ok {
		if existing.Attempts >= 3 {
			return "", errors.New("çok fazla deneme yaptınız, lütfen 5 dakika bekleyin")
		}
	}

	// 6 haneli kod oluştur
	code := fmt.Sprintf("%06d", rand.Intn(1000000))

	s.otpStore[phone] = &models.OTPRecord{
		Phone:     phone,
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute).Unix(),
		Attempts:  0,
	}

	return code, nil
}

func (s *AuthService) VerifyOTP(ctx context.Context, phone, code string) error {
	s.otpMutex.Lock()
	defer s.otpMutex.Unlock()

	record, ok := s.otpStore[phone]
	if !ok {
		return errors.New("doğrulama kodu bulunamadı")
	}

	if time.Now().Unix() > record.ExpiresAt {
		delete(s.otpStore, phone)
		return errors.New("doğrulama kodunun süresi dolmuş")
	}

	record.Attempts++
	if record.Attempts > 3 {
		return errors.New("çok fazla hatalı deneme")
	}

	if record.Code != code {
		return errors.New("doğrulama kodu hatalı")
	}

	// Başarılı doğrulama
	delete(s.otpStore, phone)

	// Şoförün phone verified durumunu güncelle
	driver, err := s.driverRepo.GetByPhone(ctx, phone)
	if err != nil {
		return err
	}
	if driver != nil {
		return s.driverRepo.UpdatePhoneVerified(ctx, driver.ID)
	}

	return nil
}

func (s *AuthService) IsSMSVerificationEnabled(ctx context.Context) (bool, error) {
	setting, err := s.settingsRepo.Get(ctx, "sms_verification_enabled")
	if err != nil {
		return false, err
	}
	if setting == nil {
		return false, nil
	}
	return setting.Value == "true", nil
}

func (s *AuthService) generateDriverTokens(driver *models.Driver) (*models.AuthResponse, error) {
	claims := &models.TokenClaims{
		UserID: driver.ID,
		Type:   models.TokenTypeDriver,
		Phone:  driver.Phone,
	}

	accessToken, err := middleware.GenerateAccessToken(claims)
	if err != nil {
		return nil, err
	}

	refreshToken, err := middleware.GenerateRefreshToken(claims)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    86400, // 24 saat
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) generateAdminTokens(admin *models.AdminUser) (*models.AuthResponse, error) {
	claims := &models.TokenClaims{
		UserID: admin.ID,
		Type:   models.TokenTypeAdmin,
		Email:  admin.Email,
		Role:   string(admin.Role),
	}

	accessToken, err := middleware.GenerateAccessToken(claims)
	if err != nil {
		return nil, err
	}

	refreshToken, err := middleware.GenerateRefreshToken(claims)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    86400,
		TokenType:    "Bearer",
	}, nil
}
