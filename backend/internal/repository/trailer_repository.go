package repository

import (
	"context"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TrailerRepository struct {
	db *PostgresDB
}

func NewTrailerRepository(db *PostgresDB) *TrailerRepository {
	return &TrailerRepository{db: db}
}

func (r *TrailerRepository) Create(ctx context.Context, trailer *models.Trailer) error {
	trailer.ID = uuid.New()
	trailer.CreatedAt = time.Now()
	trailer.UpdatedAt = time.Now()
	trailer.IsActive = true

	query := `
		INSERT INTO trailers (id, driver_id, plate, trailer_type, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		trailer.ID, trailer.DriverID, trailer.Plate, trailer.TrailerType,
		trailer.IsActive, trailer.CreatedAt, trailer.UpdatedAt,
	)

	return err
}

func (r *TrailerRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Trailer, error) {
	query := `
		SELECT id, driver_id, plate, trailer_type, is_active, created_at, updated_at
		FROM trailers WHERE id = $1
	`

	var trailer models.Trailer
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&trailer.ID, &trailer.DriverID, &trailer.Plate, &trailer.TrailerType,
		&trailer.IsActive, &trailer.CreatedAt, &trailer.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &trailer, nil
}

func (r *TrailerRepository) GetByDriverID(ctx context.Context, driverID uuid.UUID) ([]models.Trailer, error) {
	query := `
		SELECT id, driver_id, plate, trailer_type, is_active, created_at, updated_at
		FROM trailers WHERE driver_id = $1 ORDER BY created_at DESC
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trailers []models.Trailer
	for rows.Next() {
		var t models.Trailer
		err := rows.Scan(
			&t.ID, &t.DriverID, &t.Plate, &t.TrailerType,
			&t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		trailers = append(trailers, t)
	}

	return trailers, nil
}

func (r *TrailerRepository) Update(ctx context.Context, trailer *models.Trailer) error {
	trailer.UpdatedAt = time.Now()

	query := `
		UPDATE trailers SET
			plate = $2, trailer_type = $3, is_active = $4, updated_at = $5
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		trailer.ID, trailer.Plate, trailer.TrailerType, trailer.IsActive, trailer.UpdatedAt,
	)

	return err
}

func (r *TrailerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM trailers WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}
