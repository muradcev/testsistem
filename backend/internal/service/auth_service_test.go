package service

import (
	"context"
	"testing"
	"time"

	"nakliyeo-mobil/internal/models"
	"nakliyeo-mobil/internal/repository"

	"github.com/google/uuid"
	"github.com/pashagolub/pgxmock/v4"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
)

func createTestAuthService(t *testing.T) (*AuthService, pgxmock.PgxPoolIface) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}

	db := &repository.PostgresDB{Pool: mock}
	driverRepo := repository.NewDriverRepository(db)
	adminRepo := repository.NewAdminRepository(db)
	settingsRepo := repository.NewSettingsRepository(db)

	service := NewAuthService(driverRepo, adminRepo, settingsRepo)
	return service, mock
}

func TestAuthService_RegisterDriver(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()

	req := &models.DriverRegisterRequest{
		Phone:    "5551234567",
		Name:     "Test",
		Surname:  "User",
		Password: "testpass123",
		Province: "Istanbul",
		District: "Kadikoy",
	}

	// Phone check - not found
	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(req.Phone).
		WillReturnRows(pgxmock.NewRows(nil))

	// Create driver
	mock.ExpectExec("INSERT INTO drivers").
		WithArgs(
			pgxmock.AnyArg(), // ID
			req.Phone,
			req.Name,
			req.Surname,
			pgxmock.AnyArg(), // password_hash
			req.Province,
			req.District,
			pgxmock.AnyArg(), // neighborhood
			pgxmock.AnyArg(), // home_latitude
			pgxmock.AnyArg(), // home_longitude
			true,             // is_active
			false,            // is_phone_verified
			"unknown",        // current_status
			pgxmock.AnyArg(), // created_at
			pgxmock.AnyArg(), // updated_at
		).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	driver, err := service.RegisterDriver(context.Background(), req)
	assert.NoError(t, err)
	assert.NotNil(t, driver)
	assert.Equal(t, req.Phone, driver.Phone)
	assert.Equal(t, req.Name, driver.Name)
}

func TestAuthService_RegisterDriver_PhoneExists(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()

	req := &models.DriverRegisterRequest{
		Phone:    "5551234567",
		Name:     "Test",
		Surname:  "User",
		Password: "testpass123",
	}

	driverID := uuid.New()
	now := time.Now()

	// Phone already exists
	rows := pgxmock.NewRows([]string{
		"id", "phone", "name", "surname", "password_hash",
		"province", "district", "neighborhood",
		"home_latitude", "home_longitude", "fcm_token",
		"is_active", "is_phone_verified",
		"last_location_at", "last_latitude", "last_longitude", "current_status",
		"app_version", "app_build_number", "device_model", "device_os", "device_os_version",
		"last_active_at", "app_installed_at", "push_enabled", "location_permission", "background_location_enabled",
		"contacts_permission", "phone_permission", "call_log_permission", "notification_permission",
		"battery_optimization_disabled",
		"contacts_enabled", "call_log_enabled", "surveys_enabled", "questions_enabled",
		"created_at", "updated_at",
	}).AddRow(
		driverID, req.Phone, "Existing", "User", "hashedpass",
		"Istanbul", "Kadikoy", nil,
		nil, nil, nil,
		true, true,
		nil, nil, nil, "idle",
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil,
		false,
		true, true, true, true,
		now, now,
	)

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(req.Phone).
		WillReturnRows(rows)

	driver, err := service.RegisterDriver(context.Background(), req)
	assert.Error(t, err)
	assert.Nil(t, driver)
	assert.Contains(t, err.Error(), "zaten kayıtlı")
}

func TestAuthService_LoginDriver(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()

	password := "testpass123"
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	req := &models.DriverLoginRequest{
		Phone:    "5551234567",
		Password: password,
	}

	driverID := uuid.New()
	now := time.Now()

	rows := pgxmock.NewRows([]string{
		"id", "phone", "name", "surname", "password_hash",
		"province", "district", "neighborhood",
		"home_latitude", "home_longitude", "fcm_token",
		"is_active", "is_phone_verified",
		"last_location_at", "last_latitude", "last_longitude", "current_status",
		"app_version", "app_build_number", "device_model", "device_os", "device_os_version",
		"last_active_at", "app_installed_at", "push_enabled", "location_permission", "background_location_enabled",
		"contacts_permission", "phone_permission", "call_log_permission", "notification_permission",
		"battery_optimization_disabled",
		"contacts_enabled", "call_log_enabled", "surveys_enabled", "questions_enabled",
		"created_at", "updated_at",
	}).AddRow(
		driverID, req.Phone, "Test", "User", string(hashedPassword),
		"Istanbul", "Kadikoy", nil,
		nil, nil, nil,
		true, true,
		nil, nil, nil, "idle",
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil,
		false,
		true, true, true, true,
		now, now,
	)

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(req.Phone).
		WillReturnRows(rows)

	driver, auth, err := service.LoginDriver(context.Background(), req)
	assert.NoError(t, err)
	assert.NotNil(t, driver)
	assert.NotNil(t, auth)
	assert.Equal(t, req.Phone, driver.Phone)
	assert.NotEmpty(t, auth.AccessToken)
}

func TestAuthService_LoginDriver_WrongPassword(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("correctpass"), bcrypt.DefaultCost)

	req := &models.DriverLoginRequest{
		Phone:    "5551234567",
		Password: "wrongpass",
	}

	driverID := uuid.New()
	now := time.Now()

	rows := pgxmock.NewRows([]string{
		"id", "phone", "name", "surname", "password_hash",
		"province", "district", "neighborhood",
		"home_latitude", "home_longitude", "fcm_token",
		"is_active", "is_phone_verified",
		"last_location_at", "last_latitude", "last_longitude", "current_status",
		"app_version", "app_build_number", "device_model", "device_os", "device_os_version",
		"last_active_at", "app_installed_at", "push_enabled", "location_permission", "background_location_enabled",
		"contacts_permission", "phone_permission", "call_log_permission", "notification_permission",
		"battery_optimization_disabled",
		"contacts_enabled", "call_log_enabled", "surveys_enabled", "questions_enabled",
		"created_at", "updated_at",
	}).AddRow(
		driverID, req.Phone, "Test", "User", string(hashedPassword),
		"Istanbul", "Kadikoy", nil,
		nil, nil, nil,
		true, true,
		nil, nil, nil, "idle",
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil,
		false,
		true, true, true, true,
		now, now,
	)

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(req.Phone).
		WillReturnRows(rows)

	driver, auth, err := service.LoginDriver(context.Background(), req)
	assert.Error(t, err)
	assert.Nil(t, driver)
	assert.Nil(t, auth)
	assert.Contains(t, err.Error(), "hatalı")
}

func TestAuthService_LoginDriver_NotFound(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()

	req := &models.DriverLoginRequest{
		Phone:    "5551234567",
		Password: "testpass",
	}

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(req.Phone).
		WillReturnRows(pgxmock.NewRows(nil))

	driver, auth, err := service.LoginDriver(context.Background(), req)
	assert.Error(t, err)
	assert.Nil(t, driver)
	assert.Nil(t, auth)
}

func TestAuthService_GenerateOTP(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()
	ctx := context.Background()

	phone := "5551234567"
	otp, err := service.GenerateOTP(ctx, phone)

	assert.NoError(t, err)
	assert.NotEmpty(t, otp)
	assert.Len(t, otp, 6)
}

func TestAuthService_VerifyOTP_InvalidCode(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()
	ctx := context.Background()

	phone := "5551234567"
	otp, err := service.GenerateOTP(ctx, phone)
	assert.NoError(t, err)

	// Wrong OTP - should fail without database call
	err = service.VerifyOTP(ctx, phone, "000000")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "hatalı")

	// OTP still valid, verify with correct code
	// This will call driverRepo.GetByPhone
	driverID := uuid.New()
	now := time.Now()

	rows := pgxmock.NewRows([]string{
		"id", "phone", "name", "surname", "password_hash",
		"province", "district", "neighborhood",
		"home_latitude", "home_longitude", "fcm_token",
		"is_active", "is_phone_verified",
		"last_location_at", "last_latitude", "last_longitude", "current_status",
		"app_version", "app_build_number", "device_model", "device_os", "device_os_version",
		"last_active_at", "app_installed_at", "push_enabled", "location_permission", "background_location_enabled",
		"contacts_permission", "phone_permission", "call_log_permission", "notification_permission",
		"battery_optimization_disabled",
		"contacts_enabled", "call_log_enabled", "surveys_enabled", "questions_enabled",
		"created_at", "updated_at",
	}).AddRow(
		driverID, phone, "Test", "User", "hashedpass",
		"Istanbul", "Kadikoy", nil,
		nil, nil, nil,
		true, false,
		nil, nil, nil, "idle",
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil,
		false,
		true, true, true, true,
		now, now,
	)

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(phone).
		WillReturnRows(rows)

	mock.ExpectExec("UPDATE drivers SET is_phone_verified").
		WithArgs(driverID, pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("UPDATE", 1))

	err = service.VerifyOTP(ctx, phone, otp)
	assert.NoError(t, err)
}

func TestAuthService_VerifyOTP_NotFound(t *testing.T) {
	service, mock := createTestAuthService(t)
	defer mock.Close()
	ctx := context.Background()

	phone := "5551234567"

	// OTP not generated
	err := service.VerifyOTP(ctx, phone, "123456")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "bulunamadı")
}
