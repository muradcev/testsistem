package repository

import (
	"context"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type AdminRepository struct {
	db *PostgresDB
}

func NewAdminRepository(db *PostgresDB) *AdminRepository {
	return &AdminRepository{db: db}
}

func (r *AdminRepository) Create(ctx context.Context, admin *models.AdminUser) error {
	admin.ID = uuid.New()
	admin.CreatedAt = time.Now()
	admin.UpdatedAt = time.Now()
	admin.IsActive = true

	query := `
		INSERT INTO admin_users (id, email, password_hash, name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		admin.ID, admin.Email, admin.PasswordHash, admin.Name,
		admin.Role, admin.IsActive, admin.CreatedAt, admin.UpdatedAt,
	)

	return err
}

func (r *AdminRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.AdminUser, error) {
	query := `
		SELECT id, email, password_hash, name, role, is_active, created_at, updated_at
		FROM admin_users WHERE id = $1
	`

	var admin models.AdminUser
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&admin.ID, &admin.Email, &admin.PasswordHash, &admin.Name,
		&admin.Role, &admin.IsActive, &admin.CreatedAt, &admin.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &admin, nil
}

func (r *AdminRepository) GetByEmail(ctx context.Context, email string) (*models.AdminUser, error) {
	query := `
		SELECT id, email, password_hash, name, role, is_active, created_at, updated_at
		FROM admin_users WHERE email = $1
	`

	var admin models.AdminUser
	err := r.db.Pool.QueryRow(ctx, query, email).Scan(
		&admin.ID, &admin.Email, &admin.PasswordHash, &admin.Name,
		&admin.Role, &admin.IsActive, &admin.CreatedAt, &admin.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &admin, nil
}

func (r *AdminRepository) Update(ctx context.Context, admin *models.AdminUser) error {
	admin.UpdatedAt = time.Now()

	query := `
		UPDATE admin_users SET
			name = $2, role = $3, is_active = $4, updated_at = $5
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		admin.ID, admin.Name, admin.Role, admin.IsActive, admin.UpdatedAt,
	)

	return err
}

type SettingsRepository struct {
	db *PostgresDB
}

func NewSettingsRepository(db *PostgresDB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

func (r *SettingsRepository) Get(ctx context.Context, key string) (*models.Setting, error) {
	query := `SELECT key, value, description, updated_at FROM settings WHERE key = $1`

	var setting models.Setting
	err := r.db.Pool.QueryRow(ctx, query, key).Scan(
		&setting.Key, &setting.Value, &setting.Description, &setting.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &setting, nil
}

func (r *SettingsRepository) GetAll(ctx context.Context) ([]models.Setting, error) {
	query := `SELECT key, value, description, updated_at FROM settings ORDER BY key`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settings []models.Setting
	for rows.Next() {
		var s models.Setting
		err := rows.Scan(&s.Key, &s.Value, &s.Description, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		settings = append(settings, s)
	}

	return settings, nil
}

func (r *SettingsRepository) Set(ctx context.Context, key, value string) error {
	query := `
		INSERT INTO settings (key, value, updated_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3
	`

	_, err := r.db.Pool.Exec(ctx, query, key, value, time.Now())
	return err
}

func (r *SettingsRepository) SetMultiple(ctx context.Context, settings map[string]string) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO settings (key, value, updated_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3
	`

	now := time.Now()
	for key, value := range settings {
		_, err := tx.Exec(ctx, query, key, value, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
