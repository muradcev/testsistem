package repository

import (
	"context"
	"nakliyeo-mobil/internal/models"
)

type CargoRepository struct {
	db *PostgresDB
}

func NewCargoRepository(db *PostgresDB) *CargoRepository {
	return &CargoRepository{db: db}
}

// ============================================
// Cargo Types
// ============================================

func (r *CargoRepository) GetAllCargoTypes(ctx context.Context) ([]models.CargoType, error) {
	query := `
		SELECT id, name, description, icon, is_active, sort_order, created_at, updated_at
		FROM cargo_types
		WHERE is_active = true
		ORDER BY sort_order, name
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var types []models.CargoType
	for rows.Next() {
		var t models.CargoType
		err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.Icon, &t.IsActive, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}
		types = append(types, t)
	}

	return types, nil
}

func (r *CargoRepository) GetCargoTypeByID(ctx context.Context, id string) (*models.CargoType, error) {
	query := `
		SELECT id, name, description, icon, is_active, sort_order, created_at, updated_at
		FROM cargo_types WHERE id = $1
	`

	var t models.CargoType
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.Name, &t.Description, &t.Icon, &t.IsActive, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &t, nil
}

func (r *CargoRepository) CreateCargoType(ctx context.Context, t *models.CargoType) error {
	query := `
		INSERT INTO cargo_types (name, description, icon, is_active, sort_order)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	return r.db.Pool.QueryRow(ctx, query, t.Name, t.Description, t.Icon, t.IsActive, t.SortOrder).Scan(
		&t.ID, &t.CreatedAt, &t.UpdatedAt,
	)
}

func (r *CargoRepository) UpdateCargoType(ctx context.Context, t *models.CargoType) error {
	query := `
		UPDATE cargo_types
		SET name = $2, description = $3, icon = $4, is_active = $5, sort_order = $6, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query, t.ID, t.Name, t.Description, t.Icon, t.IsActive, t.SortOrder)
	return err
}

func (r *CargoRepository) DeleteCargoType(ctx context.Context, id string) error {
	query := `UPDATE cargo_types SET is_active = false WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// ============================================
// Vehicle Brands
// ============================================

func (r *CargoRepository) GetAllVehicleBrands(ctx context.Context) ([]models.VehicleBrand, error) {
	query := `
		SELECT id, name, is_active, sort_order, created_at
		FROM vehicle_brands
		WHERE is_active = true
		ORDER BY sort_order, name
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var brands []models.VehicleBrand
	for rows.Next() {
		var b models.VehicleBrand
		err := rows.Scan(&b.ID, &b.Name, &b.IsActive, &b.SortOrder, &b.CreatedAt)
		if err != nil {
			return nil, err
		}
		brands = append(brands, b)
	}

	return brands, nil
}

func (r *CargoRepository) GetVehicleBrandsWithModels(ctx context.Context) ([]models.VehicleBrand, error) {
	brands, err := r.GetAllVehicleBrands(ctx)
	if err != nil {
		return nil, err
	}

	for i := range brands {
		models, err := r.GetVehicleModelsByBrand(ctx, brands[i].ID)
		if err != nil {
			return nil, err
		}
		brands[i].Models = models
	}

	return brands, nil
}

func (r *CargoRepository) CreateVehicleBrand(ctx context.Context, b *models.VehicleBrand) error {
	query := `
		INSERT INTO vehicle_brands (name, is_active, sort_order)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`

	return r.db.Pool.QueryRow(ctx, query, b.Name, b.IsActive, b.SortOrder).Scan(&b.ID, &b.CreatedAt)
}

func (r *CargoRepository) UpdateVehicleBrand(ctx context.Context, b *models.VehicleBrand) error {
	query := `UPDATE vehicle_brands SET name = $2, is_active = $3, sort_order = $4 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, b.ID, b.Name, b.IsActive, b.SortOrder)
	return err
}

func (r *CargoRepository) DeleteVehicleBrand(ctx context.Context, id string) error {
	query := `UPDATE vehicle_brands SET is_active = false WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// ============================================
// Vehicle Models
// ============================================

func (r *CargoRepository) GetVehicleModelsByBrand(ctx context.Context, brandID string) ([]models.VehicleModel, error) {
	query := `
		SELECT id, brand_id, name, is_active, created_at
		FROM vehicle_models
		WHERE brand_id = $1 AND is_active = true
		ORDER BY name
	`

	rows, err := r.db.Pool.Query(ctx, query, brandID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicleModels []models.VehicleModel
	for rows.Next() {
		var m models.VehicleModel
		err := rows.Scan(&m.ID, &m.BrandID, &m.Name, &m.IsActive, &m.CreatedAt)
		if err != nil {
			return nil, err
		}
		vehicleModels = append(vehicleModels, m)
	}

	return vehicleModels, nil
}

func (r *CargoRepository) CreateVehicleModel(ctx context.Context, m *models.VehicleModel) error {
	query := `
		INSERT INTO vehicle_models (brand_id, name, is_active)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`

	return r.db.Pool.QueryRow(ctx, query, m.BrandID, m.Name, m.IsActive).Scan(&m.ID, &m.CreatedAt)
}

func (r *CargoRepository) UpdateVehicleModel(ctx context.Context, m *models.VehicleModel) error {
	query := `UPDATE vehicle_models SET name = $2, is_active = $3 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, m.ID, m.Name, m.IsActive)
	return err
}

func (r *CargoRepository) DeleteVehicleModel(ctx context.Context, id string) error {
	query := `UPDATE vehicle_models SET is_active = false WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// ============================================
// Trailer Types
// ============================================

func (r *CargoRepository) GetAllTrailerTypes(ctx context.Context) ([]models.TrailerTypeConfig, error) {
	query := `
		SELECT id, name, description, is_active, sort_order, created_at
		FROM trailer_types
		WHERE is_active = true
		ORDER BY sort_order, name
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var types []models.TrailerTypeConfig
	for rows.Next() {
		var t models.TrailerTypeConfig
		err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.IsActive, &t.SortOrder, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		types = append(types, t)
	}

	return types, nil
}

func (r *CargoRepository) CreateTrailerType(ctx context.Context, t *models.TrailerTypeConfig) error {
	query := `
		INSERT INTO trailer_types (name, description, is_active, sort_order)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`

	return r.db.Pool.QueryRow(ctx, query, t.Name, t.Description, t.IsActive, t.SortOrder).Scan(&t.ID, &t.CreatedAt)
}

func (r *CargoRepository) UpdateTrailerType(ctx context.Context, t *models.TrailerTypeConfig) error {
	query := `UPDATE trailer_types SET name = $2, description = $3, is_active = $4, sort_order = $5 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, t.ID, t.Name, t.Description, t.IsActive, t.SortOrder)
	return err
}

func (r *CargoRepository) DeleteTrailerType(ctx context.Context, id string) error {
	query := `UPDATE trailer_types SET is_active = false WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// ============================================
// Trip Cargo
// ============================================

func (r *CargoRepository) CreateTripCargo(ctx context.Context, tc *models.TripCargo) error {
	query := `
		INSERT INTO trip_cargo (trip_id, cargo_type_id, cargo_type_other, weight_tons, is_full_load, load_percentage, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`

	return r.db.Pool.QueryRow(ctx, query, tc.TripID, tc.CargoTypeID, tc.CargoTypeOther, tc.WeightTons,
		tc.IsFullLoad, tc.LoadPercentage, tc.Description).Scan(&tc.ID, &tc.CreatedAt)
}

func (r *CargoRepository) GetTripCargo(ctx context.Context, tripID string) (*models.TripCargo, error) {
	query := `
		SELECT tc.id, tc.trip_id, tc.cargo_type_id, tc.cargo_type_other, tc.weight_tons,
			   tc.is_full_load, tc.load_percentage, tc.description, tc.created_at,
			   COALESCE(ct.name, '') as cargo_type_name
		FROM trip_cargo tc
		LEFT JOIN cargo_types ct ON tc.cargo_type_id = ct.id
		WHERE tc.trip_id = $1
	`

	var tc models.TripCargo
	err := r.db.Pool.QueryRow(ctx, query, tripID).Scan(
		&tc.ID, &tc.TripID, &tc.CargoTypeID, &tc.CargoTypeOther, &tc.WeightTons,
		&tc.IsFullLoad, &tc.LoadPercentage, &tc.Description, &tc.CreatedAt, &tc.CargoTypeName,
	)
	if err != nil {
		return nil, err
	}

	return &tc, nil
}

// ============================================
// Trip Pricing
// ============================================

func (r *CargoRepository) CreateTripPricing(ctx context.Context, tp *models.TripPricing) error {
	query := `
		INSERT INTO trip_pricing (trip_id, driver_id, total_price, currency, price_per_km, price_type,
								  fuel_cost, toll_cost, other_costs, paid_by, payment_status, source,
								  latitude, longitude)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, recorded_at
	`

	return r.db.Pool.QueryRow(ctx, query, tp.TripID, tp.DriverID, tp.TotalPrice, tp.Currency, tp.PricePerKm,
		tp.PriceType, tp.FuelCost, tp.TollCost, tp.OtherCosts, tp.PaidBy, tp.PaymentStatus,
		tp.Source, tp.Latitude, tp.Longitude).Scan(&tp.ID, &tp.RecordedAt)
}

func (r *CargoRepository) GetTripPricing(ctx context.Context, tripID string) (*models.TripPricing, error) {
	query := `
		SELECT id, trip_id, driver_id, total_price, currency, price_per_km, price_type,
			   fuel_cost, toll_cost, other_costs, paid_by, payment_status, source,
			   recorded_at, latitude, longitude
		FROM trip_pricing WHERE trip_id = $1
	`

	var tp models.TripPricing
	err := r.db.Pool.QueryRow(ctx, query, tripID).Scan(
		&tp.ID, &tp.TripID, &tp.DriverID, &tp.TotalPrice, &tp.Currency, &tp.PricePerKm, &tp.PriceType,
		&tp.FuelCost, &tp.TollCost, &tp.OtherCosts, &tp.PaidBy, &tp.PaymentStatus, &tp.Source,
		&tp.RecordedAt, &tp.Latitude, &tp.Longitude,
	)
	if err != nil {
		return nil, err
	}

	return &tp, nil
}

// ============================================
// Price Surveys
// ============================================

func (r *CargoRepository) CreatePriceSurvey(ctx context.Context, ps *models.PriceSurvey) error {
	query := `
		INSERT INTO price_surveys (driver_id, trip_id, from_province, from_district, to_province, to_district,
								   price, currency, cargo_type_id, weight_tons, notes, trip_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at
	`

	return r.db.Pool.QueryRow(ctx, query, ps.DriverID, ps.TripID, ps.FromProvince, ps.FromDistrict,
		ps.ToProvince, ps.ToDistrict, ps.Price, ps.Currency, ps.CargoTypeID, ps.WeightTons,
		ps.Notes, ps.TripDate).Scan(&ps.ID, &ps.CreatedAt)
}

func (r *CargoRepository) GetPriceSurveys(ctx context.Context, limit, offset int) ([]models.PriceSurvey, int, error) {
	countQuery := `SELECT COUNT(*) FROM price_surveys`
	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT ps.id, ps.driver_id, ps.trip_id, ps.from_province, ps.from_district, ps.to_province,
			   ps.to_district, ps.price, ps.currency, ps.cargo_type_id, ps.weight_tons, ps.is_verified,
			   ps.notes, ps.trip_date, ps.created_at,
			   CONCAT(d.name, ' ', d.surname) as driver_name,
			   COALESCE(ct.name, '') as cargo_type_name
		FROM price_surveys ps
		JOIN drivers d ON ps.driver_id = d.id
		LEFT JOIN cargo_types ct ON ps.cargo_type_id = ct.id
		ORDER BY ps.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var surveys []models.PriceSurvey
	for rows.Next() {
		var ps models.PriceSurvey
		err := rows.Scan(&ps.ID, &ps.DriverID, &ps.TripID, &ps.FromProvince, &ps.FromDistrict,
			&ps.ToProvince, &ps.ToDistrict, &ps.Price, &ps.Currency, &ps.CargoTypeID, &ps.WeightTons,
			&ps.IsVerified, &ps.Notes, &ps.TripDate, &ps.CreatedAt, &ps.DriverName, &ps.CargoTypeName)
		if err != nil {
			return nil, 0, err
		}
		surveys = append(surveys, ps)
	}

	return surveys, total, nil
}

func (r *CargoRepository) VerifyPriceSurvey(ctx context.Context, id string, verified bool) error {
	query := `UPDATE price_surveys SET is_verified = $2 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id, verified)
	return err
}
