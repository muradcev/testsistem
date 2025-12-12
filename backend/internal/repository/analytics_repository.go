package repository

import (
	"context"
	"nakliyeo-mobil/internal/models"
	"time"
)

type AnalyticsRepository struct {
	db *PostgresDB
}

func NewAnalyticsRepository(db *PostgresDB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

// ============================================
// Hotspots
// ============================================

func (r *AnalyticsRepository) GetAllHotspots(ctx context.Context, spotType string, verified *bool) ([]models.Hotspot, error) {
	query := `
		SELECT id, latitude, longitude, name, address, province, district, spot_type,
			   visit_count, unique_drivers, avg_duration_minutes, hourly_distribution,
			   daily_distribution, is_verified, is_auto_detected, cluster_radius_meters,
			   created_at, updated_at
		FROM hotspots
		WHERE ($1 = '' OR spot_type = $1)
		  AND ($2::boolean IS NULL OR is_verified = $2)
		ORDER BY visit_count DESC
	`

	rows, err := r.db.Pool.Query(ctx, query, spotType, verified)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hotspots []models.Hotspot
	for rows.Next() {
		var h models.Hotspot
		err := rows.Scan(&h.ID, &h.Latitude, &h.Longitude, &h.Name, &h.Address, &h.Province,
			&h.District, &h.SpotType, &h.VisitCount, &h.UniqueDrivers, &h.AvgDurationMinutes,
			&h.HourlyDistribution, &h.DailyDistribution, &h.IsVerified, &h.IsAutoDetected,
			&h.ClusterRadiusMeters, &h.CreatedAt, &h.UpdatedAt)
		if err != nil {
			return nil, err
		}
		hotspots = append(hotspots, h)
	}

	return hotspots, nil
}

func (r *AnalyticsRepository) GetHotspotByID(ctx context.Context, id string) (*models.Hotspot, error) {
	query := `
		SELECT id, latitude, longitude, name, address, province, district, spot_type,
			   visit_count, unique_drivers, avg_duration_minutes, hourly_distribution,
			   daily_distribution, is_verified, is_auto_detected, cluster_radius_meters,
			   created_at, updated_at
		FROM hotspots WHERE id = $1
	`

	var h models.Hotspot
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(&h.ID, &h.Latitude, &h.Longitude, &h.Name, &h.Address,
		&h.Province, &h.District, &h.SpotType, &h.VisitCount, &h.UniqueDrivers, &h.AvgDurationMinutes,
		&h.HourlyDistribution, &h.DailyDistribution, &h.IsVerified, &h.IsAutoDetected,
		&h.ClusterRadiusMeters, &h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &h, nil
}

func (r *AnalyticsRepository) CreateHotspot(ctx context.Context, h *models.Hotspot) error {
	query := `
		INSERT INTO hotspots (latitude, longitude, geom, name, address, province, district,
							  spot_type, is_verified, is_auto_detected, cluster_radius_meters)
		VALUES ($1, $2, ST_SetSRID(ST_MakePoint($2, $1), 4326), $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`

	return r.db.Pool.QueryRow(ctx, query, h.Latitude, h.Longitude, h.Name, h.Address, h.Province,
		h.District, h.SpotType, h.IsVerified, h.IsAutoDetected, h.ClusterRadiusMeters).Scan(
		&h.ID, &h.CreatedAt, &h.UpdatedAt)
}

func (r *AnalyticsRepository) UpdateHotspot(ctx context.Context, h *models.Hotspot) error {
	query := `
		UPDATE hotspots
		SET name = $2, address = $3, province = $4, district = $5, spot_type = $6,
			is_verified = $7, cluster_radius_meters = $8, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Pool.Exec(ctx, query, h.ID, h.Name, h.Address, h.Province, h.District,
		h.SpotType, h.IsVerified, h.ClusterRadiusMeters)
	return err
}

func (r *AnalyticsRepository) DeleteHotspot(ctx context.Context, id string) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM hotspots WHERE id = $1`, id)
	return err
}

func (r *AnalyticsRepository) GetHotspotsNearLocation(ctx context.Context, lat, lng float64, radiusMeters int) ([]models.Hotspot, error) {
	query := `
		SELECT id, latitude, longitude, name, address, province, district, spot_type,
			   visit_count, unique_drivers, avg_duration_minutes, is_verified,
			   ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
		FROM hotspots
		WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
		ORDER BY distance
		LIMIT 20
	`

	rows, err := r.db.Pool.Query(ctx, query, lat, lng, radiusMeters)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hotspots []models.Hotspot
	for rows.Next() {
		var h models.Hotspot
		var distance float64
		err := rows.Scan(&h.ID, &h.Latitude, &h.Longitude, &h.Name, &h.Address, &h.Province,
			&h.District, &h.SpotType, &h.VisitCount, &h.UniqueDrivers, &h.AvgDurationMinutes,
			&h.IsVerified, &distance)
		if err != nil {
			return nil, err
		}
		hotspots = append(hotspots, h)
	}

	return hotspots, nil
}

// DetectHotspots - Otomatik hotspot algılama
func (r *AnalyticsRepository) DetectHotspots(ctx context.Context, minVisits int, clusterRadius int) (int, error) {
	var count int
	err := r.db.Pool.QueryRow(ctx, `SELECT detect_hotspots($1, $2)`, minVisits, clusterRadius).Scan(&count)
	return count, err
}

// ============================================
// Route Segments
// ============================================

func (r *AnalyticsRepository) GetRouteSegments(ctx context.Context, fromProvince, toProvince string) ([]models.RouteSegment, error) {
	query := `
		SELECT id, from_province, from_district, from_latitude, from_longitude,
			   to_province, to_district, to_latitude, to_longitude,
			   trip_count, unique_drivers, avg_distance_km, avg_duration_minutes,
			   avg_price, min_price, max_price, price_per_km_avg,
			   last_trip_at, created_at, updated_at
		FROM route_segments
		WHERE ($1 = '' OR from_province = $1)
		  AND ($2 = '' OR to_province = $2)
		ORDER BY trip_count DESC
		LIMIT 100
	`

	rows, err := r.db.Pool.Query(ctx, query, fromProvince, toProvince)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var segments []models.RouteSegment
	for rows.Next() {
		var s models.RouteSegment
		err := rows.Scan(&s.ID, &s.FromProvince, &s.FromDistrict, &s.FromLatitude, &s.FromLongitude,
			&s.ToProvince, &s.ToDistrict, &s.ToLatitude, &s.ToLongitude, &s.TripCount, &s.UniqueDrivers,
			&s.AvgDistanceKm, &s.AvgDurationMinutes, &s.AvgPrice, &s.MinPrice, &s.MaxPrice,
			&s.PricePerKmAvg, &s.LastTripAt, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		segments = append(segments, s)
	}

	return segments, nil
}

func (r *AnalyticsRepository) GetRoutePriceMatrix(ctx context.Context) ([]models.RoutePriceMatrix, error) {
	query := `SELECT * FROM route_price_matrix LIMIT 500`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matrix []models.RoutePriceMatrix
	for rows.Next() {
		var m models.RoutePriceMatrix
		err := rows.Scan(&m.FromProvince, &m.ToProvince, &m.TripCount, &m.AvgDistanceKm,
			&m.AvgPrice, &m.PricePerKmAvg, &m.ConfidenceLevel)
		if err != nil {
			return nil, err
		}
		matrix = append(matrix, m)
	}

	return matrix, nil
}

// ============================================
// Daily Stats
// ============================================

func (r *AnalyticsRepository) GetDailyStats(ctx context.Context, startDate, endDate time.Time) ([]models.DailyStats, error) {
	query := `
		SELECT id, stat_date, active_drivers, new_drivers, drivers_on_trip,
			   total_trips, completed_trips, total_distance_km, avg_trip_distance_km,
			   avg_price, avg_price_per_km, total_revenue, total_cargo_tons,
			   province_distribution, cargo_type_distribution, created_at
		FROM daily_stats
		WHERE stat_date >= $1 AND stat_date <= $2
		ORDER BY stat_date DESC
	`

	rows, err := r.db.Pool.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.DailyStats
	for rows.Next() {
		var s models.DailyStats
		err := rows.Scan(&s.ID, &s.StatDate, &s.ActiveDrivers, &s.NewDrivers, &s.DriversOnTrip,
			&s.TotalTrips, &s.CompletedTrips, &s.TotalDistanceKm, &s.AvgTripDistanceKm,
			&s.AvgPrice, &s.AvgPricePerKm, &s.TotalRevenue, &s.TotalCargoTons,
			&s.ProvinceDistribution, &s.CargoTypeDistribution, &s.CreatedAt)
		if err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}

	return stats, nil
}

// GenerateDailyStats - Günlük istatistik oluştur
func (r *AnalyticsRepository) GenerateDailyStats(ctx context.Context, date time.Time) error {
	query := `
		INSERT INTO daily_stats (stat_date, active_drivers, new_drivers, drivers_on_trip,
								 total_trips, completed_trips, total_distance_km, avg_trip_distance_km,
								 avg_price, avg_price_per_km, total_revenue, total_cargo_tons)
		SELECT
			$1::date as stat_date,
			(SELECT COUNT(*) FROM drivers WHERE is_active = true) as active_drivers,
			(SELECT COUNT(*) FROM drivers WHERE created_at::date = $1::date) as new_drivers,
			(SELECT COUNT(DISTINCT driver_id) FROM trips WHERE status = 'ongoing' AND started_at::date = $1::date) as drivers_on_trip,
			(SELECT COUNT(*) FROM trips WHERE started_at::date = $1::date) as total_trips,
			(SELECT COUNT(*) FROM trips WHERE ended_at::date = $1::date AND status = 'completed') as completed_trips,
			(SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE ended_at::date = $1::date) as total_distance_km,
			(SELECT COALESCE(AVG(distance_km), 0) FROM trips WHERE ended_at::date = $1::date) as avg_trip_distance_km,
			(SELECT COALESCE(AVG(total_price), 0) FROM trip_pricing WHERE recorded_at::date = $1::date) as avg_price,
			(SELECT COALESCE(AVG(price_per_km), 0) FROM trip_pricing WHERE recorded_at::date = $1::date) as avg_price_per_km,
			(SELECT COALESCE(SUM(total_price), 0) FROM trip_pricing WHERE recorded_at::date = $1::date) as total_revenue,
			(SELECT COALESCE(SUM(weight_tons), 0) FROM trip_cargo tc JOIN trips t ON tc.trip_id = t.id WHERE t.ended_at::date = $1::date) as total_cargo_tons
		ON CONFLICT (stat_date) DO UPDATE SET
			active_drivers = EXCLUDED.active_drivers,
			new_drivers = EXCLUDED.new_drivers,
			drivers_on_trip = EXCLUDED.drivers_on_trip,
			total_trips = EXCLUDED.total_trips,
			completed_trips = EXCLUDED.completed_trips,
			total_distance_km = EXCLUDED.total_distance_km,
			avg_trip_distance_km = EXCLUDED.avg_trip_distance_km,
			avg_price = EXCLUDED.avg_price,
			avg_price_per_km = EXCLUDED.avg_price_per_km,
			total_revenue = EXCLUDED.total_revenue,
			total_cargo_tons = EXCLUDED.total_cargo_tons
	`

	_, err := r.db.Pool.Exec(ctx, query, date)
	return err
}

// ============================================
// Driver Routes (Güzergah görüntüleme)
// ============================================

// GetDriverRoutes - Şoförün güzergahlarını getir
func (r *AnalyticsRepository) GetDriverRoutes(ctx context.Context, driverID string, startDate, endDate time.Time) ([]map[string]interface{}, error) {
	query := `
		SELECT
			t.id as trip_id,
			t.start_latitude, t.start_longitude, t.start_province,
			t.end_latitude, t.end_longitude, t.end_province,
			t.distance_km, t.duration_minutes,
			t.started_at, t.ended_at, t.status,
			tc.cargo_type_id, ct.name as cargo_type_name, tc.weight_tons,
			tp.total_price
		FROM trips t
		LEFT JOIN trip_cargo tc ON t.id = tc.trip_id
		LEFT JOIN cargo_types ct ON tc.cargo_type_id = ct.id
		LEFT JOIN trip_pricing tp ON t.id = tp.trip_id
		WHERE t.driver_id = $1
		  AND t.started_at >= $2
		  AND t.started_at <= $3
		ORDER BY t.started_at DESC
	`

	rows, err := r.db.Pool.Query(ctx, query, driverID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routes []map[string]interface{}
	for rows.Next() {
		var tripID, startProvince, endProvince string
		var startLat, startLng, endLat, endLng, distanceKm, weightTons, totalPrice *float64
		var durationMinutes *int
		var startedAt, endedAt *time.Time
		var status string
		var cargoTypeID, cargoTypeName *string

		err := rows.Scan(&tripID, &startLat, &startLng, &startProvince,
			&endLat, &endLng, &endProvince, &distanceKm, &durationMinutes,
			&startedAt, &endedAt, &status, &cargoTypeID, &cargoTypeName, &weightTons, &totalPrice)
		if err != nil {
			return nil, err
		}

		route := map[string]interface{}{
			"trip_id":          tripID,
			"start_latitude":   startLat,
			"start_longitude":  startLng,
			"start_province":   startProvince,
			"end_latitude":     endLat,
			"end_longitude":    endLng,
			"end_province":     endProvince,
			"distance_km":      distanceKm,
			"duration_minutes": durationMinutes,
			"started_at":       startedAt,
			"ended_at":         endedAt,
			"status":           status,
			"cargo_type":       cargoTypeName,
			"weight_tons":      weightTons,
			"price":            totalPrice,
		}
		routes = append(routes, route)
	}

	return routes, nil
}

// GetTripLocations - Bir seferin konum geçmişini getir
func (r *AnalyticsRepository) GetTripLocations(ctx context.Context, tripID string) ([]map[string]interface{}, error) {
	query := `
		SELECT l.latitude, l.longitude, l.speed, l.recorded_at
		FROM locations l
		JOIN trips t ON l.driver_id = t.driver_id
		WHERE t.id = $1
		  AND l.recorded_at >= t.started_at
		  AND (t.ended_at IS NULL OR l.recorded_at <= t.ended_at)
		ORDER BY l.recorded_at
	`

	rows, err := r.db.Pool.Query(ctx, query, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []map[string]interface{}
	for rows.Next() {
		var lat, lng, speed float64
		var recordedAt time.Time

		err := rows.Scan(&lat, &lng, &speed, &recordedAt)
		if err != nil {
			return nil, err
		}

		locations = append(locations, map[string]interface{}{
			"latitude":    lat,
			"longitude":   lng,
			"speed":       speed,
			"recorded_at": recordedAt,
		})
	}

	return locations, nil
}

// GetTripStops - Bir seferin duraklarını getir
func (r *AnalyticsRepository) GetTripStops(ctx context.Context, tripID string) ([]models.Stop, error) {
	query := `
		SELECT id, driver_id, trip_id, latitude, longitude, location_type,
			   address, province, district, started_at, ended_at, duration_minutes,
			   is_in_vehicle, cargo_action, created_at
		FROM stops
		WHERE trip_id = $1
		ORDER BY started_at
	`

	rows, err := r.db.Pool.Query(ctx, query, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		var cargoAction *string
		err := rows.Scan(&s.ID, &s.DriverID, &s.TripID, &s.Latitude, &s.Longitude,
			&s.LocationType, &s.Address, &s.Province, &s.District, &s.StartedAt,
			&s.EndedAt, &s.DurationMinutes, &s.IsInVehicle, &cargoAction, &s.CreatedAt)
		if err != nil {
			return nil, err
		}
		stops = append(stops, s)
	}

	return stops, nil
}

// ============================================
// Province Analytics
// ============================================

// GetProvinceStats - İl bazlı istatistikler
func (r *AnalyticsRepository) GetProvinceStats(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT
			province,
			COUNT(DISTINCT d.id) as driver_count,
			COUNT(DISTINCT t.id) as trip_count,
			COALESCE(SUM(t.distance_km), 0) as total_distance_km,
			COALESCE(AVG(tp.total_price), 0) as avg_price
		FROM drivers d
		LEFT JOIN trips t ON d.id = t.driver_id
		LEFT JOIN trip_pricing tp ON t.id = tp.trip_id
		WHERE d.province IS NOT NULL AND d.province != ''
		GROUP BY d.province
		ORDER BY driver_count DESC
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []map[string]interface{}
	for rows.Next() {
		var province string
		var driverCount, tripCount int
		var totalDistanceKm, avgPrice float64

		err := rows.Scan(&province, &driverCount, &tripCount, &totalDistanceKm, &avgPrice)
		if err != nil {
			return nil, err
		}

		stats = append(stats, map[string]interface{}{
			"province":          province,
			"driver_count":      driverCount,
			"trip_count":        tripCount,
			"total_distance_km": totalDistanceKm,
			"avg_price":         avgPrice,
		})
	}

	return stats, nil
}

// GetRouteHeatmap - Güzergah ısı haritası verileri
func (r *AnalyticsRepository) GetRouteHeatmap(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT
			from_province,
			to_province,
			trip_count,
			avg_distance_km,
			avg_price
		FROM route_segments
		WHERE trip_count >= 1
		ORDER BY trip_count DESC
		LIMIT 200
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var heatmap []map[string]interface{}
	for rows.Next() {
		var fromProvince, toProvince string
		var tripCount int
		var avgDistanceKm, avgPrice float64

		err := rows.Scan(&fromProvince, &toProvince, &tripCount, &avgDistanceKm, &avgPrice)
		if err != nil {
			return nil, err
		}

		heatmap = append(heatmap, map[string]interface{}{
			"from_province":   fromProvince,
			"to_province":     toProvince,
			"trip_count":      tripCount,
			"avg_distance_km": avgDistanceKm,
			"avg_price":       avgPrice,
		})
	}

	return heatmap, nil
}
