package models

import (
	"github.com/google/uuid"
)

type TokenType string

const (
	TokenTypeDriver TokenType = "driver"
	TokenTypeAdmin  TokenType = "admin"
)

type TokenClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	Type     TokenType `json:"type"`
	Phone    string    `json:"phone,omitempty"`
	Email    string    `json:"email,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type OTPRequest struct {
	Phone string `json:"phone" binding:"required"`
}

type OTPVerifyRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type OTPRecord struct {
	Phone     string
	Code      string
	ExpiresAt int64
	Attempts  int
}
