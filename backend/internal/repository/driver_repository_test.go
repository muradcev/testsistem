package repository

import (
	"context"
	"testing"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/pashagolub/pgxmock/v4"
	"github.com/stretchr/testify/assert"
)

func TestDriverRepository_Create(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	repo := &DriverRepository{db: &PostgresDB{Pool: mock}}

	driver := &models.Driver{
		Phone:    "5551234567",
		Name:     "Test",
		Surname:  "User",
		Province: "Istanbul",
		District: "Kadikoy",
	}

	mock.ExpectExec("INSERT INTO drivers").
		WithArgs(
			pgxmock.AnyArg(), // ID
			driver.Phone,
			driver.Name,
			driver.Surname,
			driver.PasswordHash,
			driver.Province,
			driver.District,
			driver.Neighborhood,
			driver.HomeLatitude,
			driver.HomeLongitude,
			true,      // is_active
			false,     // is_phone_verified
			"unknown", // current_status
			pgxmock.AnyArg(),
			pgxmock.AnyArg(),
		).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	err = repo.Create(context.Background(), driver)
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, driver.ID)
	assert.True(t, driver.IsActive)
	assert.Equal(t, "unknown", driver.CurrentStatus)
}

func TestDriverRepository_GetByID(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	repo := &DriverRepository{db: &PostgresDB{Pool: mock}}

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
		"contacts_permission", "phone_permission", "notification_permission",
		"contacts_enabled", "call_log_enabled", "surveys_enabled", "questions_enabled",
		"created_at", "updated_at",
	}).AddRow(
		driverID, "5551234567", "Test", "User", "hashedpass",
		"Istanbul", "Kadikoy", "Moda",
		nil, nil, nil,
		true, true,
		nil, nil, nil, "idle",
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		nil, nil, nil,
		true, true, true, true,
		now, now,
	)

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE id").
		WithArgs(driverID).
		WillReturnRows(rows)

	driver, err := repo.GetByID(context.Background(), driverID)
	assert.NoError(t, err)
	assert.NotNil(t, driver)
	assert.Equal(t, driverID, driver.ID)
	assert.Equal(t, "Test", driver.Name)
	assert.Equal(t, "User", driver.Surname)
	assert.True(t, driver.IsActive)
}

func TestDriverRepository_GetByID_NotFound(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	repo := &DriverRepository{db: &PostgresDB{Pool: mock}}

	driverID := uuid.New()

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE id").
		WithArgs(driverID).
		WillReturnRows(pgxmock.NewRows(nil))

	driver, err := repo.GetByID(context.Background(), driverID)
	assert.NoError(t, err)
	assert.Nil(t, driver)
}

func TestDriverRepository_GetByPhone(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	repo := &DriverRepository{db: &PostgresDB{Pool: mock}}

	phone := "5551234567"
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
		"contacts_permission", "phone_permission", "notification_permission",
		"contacts_enabled", "call_log_enabled", "surveys_enabled", "questions_enabled",
		"created_at", "updated_at",
	}).AddRow(
		driverID, phone, "Test", "User", "hashedpass",
		"Istanbul", "Kadikoy", "Moda",
		nil, nil, nil,
		true, true,
		nil, nil, nil, "idle",
		nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		nil, nil, nil,
		true, true, true, true,
		now, now,
	)

	mock.ExpectQuery("SELECT (.+) FROM drivers WHERE phone").
		WithArgs(phone).
		WillReturnRows(rows)

	driver, err := repo.GetByPhone(context.Background(), phone)
	assert.NoError(t, err)
	assert.NotNil(t, driver)
	assert.Equal(t, phone, driver.Phone)
}
