package repository

import (
	"context"
	"fmt"
	"time"

	"nakliyeo-mobil/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TransportRepository struct {
	db *PostgresDB
}

func NewTransportRepository(db *PostgresDB) *TransportRepository {
	return &TransportRepository{db: db}
}

// Create - Yeni taşıma kaydı oluştur
func (r *TransportRepository) Create(ctx context.Context, record *models.TransportRecord) error {
	record.ID = uuid.New()
	record.CreatedAt = time.Now()
	record.UpdatedAt = time.Now()

	if record.Currency == "" {
		record.Currency = "TRY"
	}
	if record.SourceType == "" {
		record.SourceType = "manual"
	}

	query := `
		INSERT INTO transport_records (
			id, driver_id, plate, trailer_type,
			origin_province, origin_district, destination_province, destination_district,
			transport_date, price, currency, cargo_type, cargo_weight, distance_km,
			notes, source_type, source_id, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)
	`

	_, err := r.db.Pool.Exec(ctx, query,
		record.ID, record.DriverID, record.Plate, record.TrailerType,
		record.OriginProvince, record.OriginDistrict, record.DestinationProvince, record.DestinationDistrict,
		record.TransportDate, record.Price, record.Currency, record.CargoType, record.CargoWeight, record.DistanceKm,
		record.Notes, record.SourceType, record.SourceID, record.CreatedAt, record.UpdatedAt,
	)

	return err
}

// GetByID - ID ile taşıma kaydı getir
func (r *TransportRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.TransportRecordWithDriver, error) {
	query := `
		SELECT
			tr.id, tr.driver_id, tr.plate, tr.trailer_type,
			tr.origin_province, tr.origin_district, tr.destination_province, tr.destination_district,
			tr.transport_date, tr.price, tr.currency, tr.cargo_type, tr.cargo_weight, tr.distance_km,
			tr.notes, tr.source_type, tr.source_id, tr.created_at, tr.updated_at,
			d.name, d.surname, d.phone, d.province
		FROM transport_records tr
		JOIN drivers d ON tr.driver_id = d.id
		WHERE tr.id = $1
	`

	var record models.TransportRecordWithDriver
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&record.ID, &record.DriverID, &record.Plate, &record.TrailerType,
		&record.OriginProvince, &record.OriginDistrict, &record.DestinationProvince, &record.DestinationDistrict,
		&record.TransportDate, &record.Price, &record.Currency, &record.CargoType, &record.CargoWeight, &record.DistanceKm,
		&record.Notes, &record.SourceType, &record.SourceID, &record.CreatedAt, &record.UpdatedAt,
		&record.DriverName, &record.DriverSurname, &record.DriverPhone, &record.DriverProvince,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &record, nil
}

// GetAll - Tüm taşıma kayıtlarını getir (filtreleme ile)
func (r *TransportRepository) GetAll(ctx context.Context, limit, offset int, filters map[string]interface{}) ([]models.TransportRecordWithDriver, int, error) {
	// Toplam sayı
	countQuery := `SELECT COUNT(*) FROM transport_records tr WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	// Filtreler
	if driverID, ok := filters["driver_id"].(uuid.UUID); ok {
		countQuery += fmt.Sprintf(" AND tr.driver_id = $%d", argIdx)
		args = append(args, driverID)
		argIdx++
	}
	if origin, ok := filters["origin_province"].(string); ok && origin != "" {
		countQuery += fmt.Sprintf(" AND tr.origin_province = $%d", argIdx)
		args = append(args, origin)
		argIdx++
	}
	if dest, ok := filters["destination_province"].(string); ok && dest != "" {
		countQuery += fmt.Sprintf(" AND tr.destination_province = $%d", argIdx)
		args = append(args, dest)
		argIdx++
	}
	if trailerType, ok := filters["trailer_type"].(string); ok && trailerType != "" {
		countQuery += fmt.Sprintf(" AND tr.trailer_type = $%d", argIdx)
		args = append(args, trailerType)
		argIdx++
	}
	if startDate, ok := filters["start_date"].(time.Time); ok {
		countQuery += fmt.Sprintf(" AND tr.transport_date >= $%d", argIdx)
		args = append(args, startDate)
		argIdx++
	}
	if endDate, ok := filters["end_date"].(time.Time); ok {
		countQuery += fmt.Sprintf(" AND tr.transport_date <= $%d", argIdx)
		args = append(args, endDate)
		argIdx++
	}

	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Veri çekme
	query := `
		SELECT
			tr.id, tr.driver_id, tr.plate, tr.trailer_type,
			tr.origin_province, tr.origin_district, tr.destination_province, tr.destination_district,
			tr.transport_date, tr.price, tr.currency, tr.cargo_type, tr.cargo_weight, tr.distance_km,
			tr.notes, tr.source_type, tr.source_id, tr.created_at, tr.updated_at,
			d.name, d.surname, d.phone, d.province
		FROM transport_records tr
		JOIN drivers d ON tr.driver_id = d.id
		WHERE 1=1
	`

	// Aynı filtreleri uygula
	argsData := []interface{}{}
	argIdx = 1
	if driverID, ok := filters["driver_id"].(uuid.UUID); ok {
		query += fmt.Sprintf(" AND tr.driver_id = $%d", argIdx)
		argsData = append(argsData, driverID)
		argIdx++
	}
	if origin, ok := filters["origin_province"].(string); ok && origin != "" {
		query += fmt.Sprintf(" AND tr.origin_province = $%d", argIdx)
		argsData = append(argsData, origin)
		argIdx++
	}
	if dest, ok := filters["destination_province"].(string); ok && dest != "" {
		query += fmt.Sprintf(" AND tr.destination_province = $%d", argIdx)
		argsData = append(argsData, dest)
		argIdx++
	}
	if trailerType, ok := filters["trailer_type"].(string); ok && trailerType != "" {
		query += fmt.Sprintf(" AND tr.trailer_type = $%d", argIdx)
		argsData = append(argsData, trailerType)
		argIdx++
	}
	if startDate, ok := filters["start_date"].(time.Time); ok {
		query += fmt.Sprintf(" AND tr.transport_date >= $%d", argIdx)
		argsData = append(argsData, startDate)
		argIdx++
	}
	if endDate, ok := filters["end_date"].(time.Time); ok {
		query += fmt.Sprintf(" AND tr.transport_date <= $%d", argIdx)
		argsData = append(argsData, endDate)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY tr.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	argsData = append(argsData, limit, offset)

	rows, err := r.db.Pool.Query(ctx, query, argsData...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []models.TransportRecordWithDriver
	for rows.Next() {
		var record models.TransportRecordWithDriver
		err := rows.Scan(
			&record.ID, &record.DriverID, &record.Plate, &record.TrailerType,
			&record.OriginProvince, &record.OriginDistrict, &record.DestinationProvince, &record.DestinationDistrict,
			&record.TransportDate, &record.Price, &record.Currency, &record.CargoType, &record.CargoWeight, &record.DistanceKm,
			&record.Notes, &record.SourceType, &record.SourceID, &record.CreatedAt, &record.UpdatedAt,
			&record.DriverName, &record.DriverSurname, &record.DriverPhone, &record.DriverProvince,
		)
		if err != nil {
			return nil, 0, err
		}
		records = append(records, record)
	}

	return records, total, nil
}

// Update - Taşıma kaydı güncelle
func (r *TransportRepository) Update(ctx context.Context, id uuid.UUID, record *models.TransportRecord) error {
	query := `
		UPDATE transport_records SET
			plate = COALESCE($2, plate),
			trailer_type = COALESCE($3, trailer_type),
			origin_province = COALESCE($4, origin_province),
			origin_district = COALESCE($5, origin_district),
			destination_province = COALESCE($6, destination_province),
			destination_district = COALESCE($7, destination_district),
			transport_date = COALESCE($8, transport_date),
			price = COALESCE($9, price),
			currency = COALESCE($10, currency),
			cargo_type = COALESCE($11, cargo_type),
			cargo_weight = COALESCE($12, cargo_weight),
			distance_km = COALESCE($13, distance_km),
			notes = COALESCE($14, notes),
			updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query, id,
		record.Plate, record.TrailerType,
		record.OriginProvince, record.OriginDistrict, record.DestinationProvince, record.DestinationDistrict,
		record.TransportDate, record.Price, record.Currency, record.CargoType, record.CargoWeight, record.DistanceKm,
		record.Notes,
	)

	return err
}

// Delete - Taşıma kaydı sil
func (r *TransportRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM transport_records WHERE id = $1", id)
	return err
}

// GetStats - İstatistikler
func (r *TransportRepository) GetStats(ctx context.Context) (*models.TransportRecordStats, error) {
	stats := &models.TransportRecordStats{}

	// Temel istatistikler
	basicQuery := `
		SELECT
			COUNT(*),
			COUNT(DISTINCT driver_id),
			COALESCE(SUM(price), 0),
			COALESCE(AVG(price), 0),
			COALESCE(MIN(price), 0),
			COALESCE(MAX(price), 0),
			COALESCE(SUM(distance_km), 0)
		FROM transport_records
		WHERE price IS NOT NULL
	`
	err := r.db.Pool.QueryRow(ctx, basicQuery).Scan(
		&stats.TotalRecords,
		&stats.TotalDrivers,
		&stats.TotalPrice,
		&stats.AveragePrice,
		&stats.MinPrice,
		&stats.MaxPrice,
		&stats.TotalDistance,
	)
	if err != nil {
		return nil, err
	}

	// En çok yükleme yapılan iller
	originQuery := `
		SELECT origin_province, COUNT(*) as cnt
		FROM transport_records
		WHERE origin_province IS NOT NULL
		GROUP BY origin_province
		ORDER BY cnt DESC
		LIMIT 10
	`
	originRows, err := r.db.Pool.Query(ctx, originQuery)
	if err != nil {
		return nil, err
	}
	defer originRows.Close()

	for originRows.Next() {
		var rc models.RouteCount
		if err := originRows.Scan(&rc.Province, &rc.Count); err != nil {
			return nil, err
		}
		stats.TopOrigins = append(stats.TopOrigins, rc)
	}

	// En çok teslim yapılan iller
	destQuery := `
		SELECT destination_province, COUNT(*) as cnt
		FROM transport_records
		WHERE destination_province IS NOT NULL
		GROUP BY destination_province
		ORDER BY cnt DESC
		LIMIT 10
	`
	destRows, err := r.db.Pool.Query(ctx, destQuery)
	if err != nil {
		return nil, err
	}
	defer destRows.Close()

	for destRows.Next() {
		var rc models.RouteCount
		if err := destRows.Scan(&rc.Province, &rc.Count); err != nil {
			return nil, err
		}
		stats.TopDestinations = append(stats.TopDestinations, rc)
	}

	// En popüler güzergahlar
	routeQuery := `
		SELECT
			origin_province, destination_province, COUNT(*) as cnt,
			COALESCE(AVG(price), 0), COALESCE(MIN(price), 0), COALESCE(MAX(price), 0)
		FROM transport_records
		WHERE origin_province IS NOT NULL AND destination_province IS NOT NULL AND price IS NOT NULL
		GROUP BY origin_province, destination_province
		ORDER BY cnt DESC
		LIMIT 10
	`
	routeRows, err := r.db.Pool.Query(ctx, routeQuery)
	if err != nil {
		return nil, err
	}
	defer routeRows.Close()

	for routeRows.Next() {
		var rs models.RouteStats
		if err := routeRows.Scan(&rs.Origin, &rs.Destination, &rs.Count, &rs.AvgPrice, &rs.MinPrice, &rs.MaxPrice); err != nil {
			return nil, err
		}
		stats.TopRoutes = append(stats.TopRoutes, rs)
	}

	// Dorse tipi istatistikleri
	trailerQuery := `
		SELECT trailer_type, COUNT(*) as cnt, COALESCE(AVG(price), 0)
		FROM transport_records
		WHERE trailer_type IS NOT NULL AND price IS NOT NULL
		GROUP BY trailer_type
		ORDER BY cnt DESC
	`
	trailerRows, err := r.db.Pool.Query(ctx, trailerQuery)
	if err != nil {
		return nil, err
	}
	defer trailerRows.Close()

	for trailerRows.Next() {
		var ts models.TrailerStats
		if err := trailerRows.Scan(&ts.TrailerType, &ts.Count, &ts.AvgPrice); err != nil {
			return nil, err
		}
		stats.TrailerTypeStats = append(stats.TrailerTypeStats, ts)
	}

	return stats, nil
}

// GetTrailerTypes - Dorse tiplerini getir
func (r *TransportRepository) GetTrailerTypes(ctx context.Context) ([]models.TrailerTypeRef, error) {
	query := `SELECT id, name, description, is_active, created_at FROM trailer_types WHERE is_active = true ORDER BY name`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var types []models.TrailerTypeRef
	for rows.Next() {
		var t models.TrailerTypeRef
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.IsActive, &t.CreatedAt); err != nil {
			return nil, err
		}
		types = append(types, t)
	}

	return types, nil
}

// GetPricesByRoute - Güzergah bazında fiyatları getir
func (r *TransportRepository) GetPricesByRoute(ctx context.Context, origin, destination string, limit int) ([]models.TransportRecordWithDriver, error) {
	query := `
		SELECT
			tr.id, tr.driver_id, tr.plate, tr.trailer_type,
			tr.origin_province, tr.origin_district, tr.destination_province, tr.destination_district,
			tr.transport_date, tr.price, tr.currency, tr.cargo_type, tr.cargo_weight, tr.distance_km,
			tr.notes, tr.source_type, tr.source_id, tr.created_at, tr.updated_at,
			d.name, d.surname, d.phone, d.province
		FROM transport_records tr
		JOIN drivers d ON tr.driver_id = d.id
		WHERE tr.origin_province = $1 AND tr.destination_province = $2
		ORDER BY tr.transport_date DESC
		LIMIT $3
	`

	rows, err := r.db.Pool.Query(ctx, query, origin, destination, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.TransportRecordWithDriver
	for rows.Next() {
		var record models.TransportRecordWithDriver
		err := rows.Scan(
			&record.ID, &record.DriverID, &record.Plate, &record.TrailerType,
			&record.OriginProvince, &record.OriginDistrict, &record.DestinationProvince, &record.DestinationDistrict,
			&record.TransportDate, &record.Price, &record.Currency, &record.CargoType, &record.CargoWeight, &record.DistanceKm,
			&record.Notes, &record.SourceType, &record.SourceID, &record.CreatedAt, &record.UpdatedAt,
			&record.DriverName, &record.DriverSurname, &record.DriverPhone, &record.DriverProvince,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	return records, nil
}
