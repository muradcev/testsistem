package models

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestAuditLog_JSON(t *testing.T) {
	userID := uuid.New()
	email := "test@example.com"
	ip := "192.168.1.1"

	log := AuditLog{
		ID:           uuid.New(),
		UserID:       &userID,
		UserType:     "admin",
		UserEmail:    &email,
		Action:       AuditActionCreate,
		ResourceType: AuditResourceDriver,
		IPAddress:    &ip,
		CreatedAt:    time.Now(),
	}

	// Test JSON marshaling
	data, err := json.Marshal(log)
	if err != nil {
		t.Fatalf("Failed to marshal AuditLog: %v", err)
	}

	// Test JSON unmarshaling
	var decoded AuditLog
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal AuditLog: %v", err)
	}

	if decoded.Action != AuditActionCreate {
		t.Errorf("Expected action %s, got %s", AuditActionCreate, decoded.Action)
	}

	if decoded.ResourceType != AuditResourceDriver {
		t.Errorf("Expected resource type %s, got %s", AuditResourceDriver, decoded.ResourceType)
	}
}

func TestAuditActionConstants(t *testing.T) {
	actions := []string{
		AuditActionLogin,
		AuditActionLogout,
		AuditActionCreate,
		AuditActionUpdate,
		AuditActionDelete,
		AuditActionView,
		AuditActionApprove,
		AuditActionReject,
		AuditActionSend,
	}

	for _, action := range actions {
		if action == "" {
			t.Error("Audit action constant should not be empty")
		}
	}
}

func TestAuditResourceConstants(t *testing.T) {
	resources := []string{
		AuditResourceDriver,
		AuditResourceVehicle,
		AuditResourceTrailer,
		AuditResourceQuestion,
		AuditResourceSurvey,
		AuditResourceTrip,
		AuditResourceAdmin,
		AuditResourceSettings,
		AuditResourceNotification,
	}

	for _, resource := range resources {
		if resource == "" {
			t.Error("Audit resource constant should not be empty")
		}
	}
}
