package service

import (
	"context"
	"log"
	"nakliyeo-mobil/internal/repository"
	"time"
)

// AnalyticsGeneratorService - Analytics veri oluşturma servisi
type AnalyticsGeneratorService struct {
	db            repository.PgxPool
	stopRepo      *repository.StopRepository
	locationRepo  *repository.LocationRepository
	analyticsRepo *repository.AnalyticsRepository
}

func NewAnalyticsGeneratorService(
	db repository.PgxPool,
	stopRepo *repository.StopRepository,
	locationRepo *repository.LocationRepository,
	analyticsRepo *repository.AnalyticsRepository,
) *AnalyticsGeneratorService {
	return &AnalyticsGeneratorService{
		db:            db,
		stopRepo:      stopRepo,
		locationRepo:  locationRepo,
		analyticsRepo: analyticsRepo,
	}
}

// GenerateHotspotsFromStops - Duraklardan hotspot oluştur
func (s *AnalyticsGeneratorService) GenerateHotspotsFromStops(ctx context.Context, minVisits int) (int, error) {
	// Get stop clusters from stops table
	query := `
		WITH stop_clusters AS (
			SELECT
				ROUND(latitude::numeric, 3) as lat_cluster,
				ROUND(longitude::numeric, 3) as lng_cluster,
				province,
				district,
				COUNT(*) as visit_count,
				COUNT(DISTINCT driver_id) as unique_drivers,
				AVG(duration_minutes) as avg_duration
			FROM stops
			WHERE latitude IS NOT NULL AND longitude IS NOT NULL
			GROUP BY lat_cluster, lng_cluster, province, district
			HAVING COUNT(*) >= $1
		)
		INSERT INTO hotspots (latitude, longitude, province, district, spot_type, visit_count, unique_drivers, avg_duration_minutes, is_auto_detected, is_verified)
		SELECT
			lat_cluster::float8,
			lng_cluster::float8,
			province,
			district,
			'stop',
			visit_count,
			unique_drivers,
			COALESCE(avg_duration, 0),
			true,
			false
		FROM stop_clusters
		ON CONFLICT DO NOTHING
		RETURNING id
	`

	rows, err := s.db.Query(ctx, query, minVisits)
	if err != nil {
		log.Printf("Hotspot generation failed: %v", err)
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
	}

	return count, nil
}

// GenerateRouteSegments - Trip verilerinden route segment oluştur
func (s *AnalyticsGeneratorService) GenerateRouteSegments(ctx context.Context) (int, error) {
	query := `
		INSERT INTO route_segments (
			from_province, from_district, from_latitude, from_longitude,
			to_province, to_district, to_latitude, to_longitude,
			trip_count, unique_drivers, avg_distance_km, avg_duration_minutes,
			last_trip_at
		)
		SELECT
			start_province as from_province,
			'' as from_district,
			AVG(start_latitude) as from_latitude,
			AVG(start_longitude) as from_longitude,
			end_province as to_province,
			'' as to_district,
			AVG(end_latitude) as to_latitude,
			AVG(end_longitude) as to_longitude,
			COUNT(*) as trip_count,
			COUNT(DISTINCT driver_id) as unique_drivers,
			AVG(distance_km) as avg_distance_km,
			AVG(duration_minutes) as avg_duration_minutes,
			MAX(ended_at) as last_trip_at
		FROM trips
		WHERE status = 'completed'
		  AND start_province IS NOT NULL
		  AND end_province IS NOT NULL
		GROUP BY start_province, end_province
		ON CONFLICT (from_province, to_province) DO UPDATE SET
			trip_count = EXCLUDED.trip_count,
			unique_drivers = EXCLUDED.unique_drivers,
			avg_distance_km = EXCLUDED.avg_distance_km,
			avg_duration_minutes = EXCLUDED.avg_duration_minutes,
			last_trip_at = EXCLUDED.last_trip_at,
			updated_at = NOW()
		RETURNING id
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		log.Printf("Route segment generation failed: %v", err)
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
	}

	return count, nil
}

// GenerateLocationHeatmap - Konum verilerinden heatmap oluştur
func (s *AnalyticsGeneratorService) GenerateLocationHeatmap(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT
			ROUND(latitude::numeric, 2) as lat,
			ROUND(longitude::numeric, 2) as lng,
			COUNT(*) as intensity
		FROM locations
		WHERE recorded_at > NOW() - INTERVAL '7 days'
		GROUP BY lat, lng
		HAVING COUNT(*) >= 5
		ORDER BY intensity DESC
		LIMIT 500
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var heatmap []map[string]interface{}
	for rows.Next() {
		var lat, lng float64
		var intensity int
		if err := rows.Scan(&lat, &lng, &intensity); err != nil {
			continue
		}
		heatmap = append(heatmap, map[string]interface{}{
			"lat":       lat,
			"lng":       lng,
			"intensity": intensity,
		})
	}

	return heatmap, nil
}

// GetStopHeatmap - Durak verilerinden heatmap (bu her zaman çalışır)
func (s *AnalyticsGeneratorService) GetStopHeatmap(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT
			latitude,
			longitude,
			province,
			district,
			COUNT(*) as stop_count,
			AVG(duration_minutes) as avg_duration
		FROM stops
		WHERE latitude IS NOT NULL AND longitude IS NOT NULL
		GROUP BY latitude, longitude, province, district
		ORDER BY stop_count DESC
		LIMIT 200
	`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var heatmap []map[string]interface{}
	for rows.Next() {
		var lat, lng float64
		var province, district *string
		var stopCount int
		var avgDuration *float64

		if err := rows.Scan(&lat, &lng, &province, &district, &stopCount, &avgDuration); err != nil {
			continue
		}

		heatmap = append(heatmap, map[string]interface{}{
			"latitude":     lat,
			"longitude":    lng,
			"province":     province,
			"district":     district,
			"stop_count":   stopCount,
			"avg_duration": avgDuration,
		})
	}

	return heatmap, nil
}

// GenerateDailyStatsSimple - Basit günlük istatistik
func (s *AnalyticsGeneratorService) GenerateDailyStatsSimple(ctx context.Context, date time.Time) error {
	query := `
		INSERT INTO daily_stats (
			stat_date,
			active_drivers,
			new_drivers,
			total_trips,
			completed_trips,
			total_distance_km
		)
		SELECT
			$1::date,
			(SELECT COUNT(*) FROM drivers WHERE is_active = true),
			(SELECT COUNT(*) FROM drivers WHERE created_at::date = $1::date),
			(SELECT COUNT(*) FROM trips WHERE started_at::date = $1::date),
			(SELECT COUNT(*) FROM trips WHERE ended_at::date = $1::date AND status = 'completed'),
			(SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE ended_at::date = $1::date)
		ON CONFLICT (stat_date) DO UPDATE SET
			active_drivers = EXCLUDED.active_drivers,
			new_drivers = EXCLUDED.new_drivers,
			total_trips = EXCLUDED.total_trips,
			completed_trips = EXCLUDED.completed_trips,
			total_distance_km = EXCLUDED.total_distance_km
	`

	_, err := s.db.Exec(ctx, query, date)
	return err
}

// RunAllGenerators - Tüm generator'ları çalıştır
func (s *AnalyticsGeneratorService) RunAllGenerators(ctx context.Context) error {
	log.Println("[ANALYTICS] Starting analytics generation...")

	// Generate daily stats for last 7 days
	for i := 0; i < 7; i++ {
		date := time.Now().AddDate(0, 0, -i)
		if err := s.GenerateDailyStatsSimple(ctx, date); err != nil {
			log.Printf("[ANALYTICS] Daily stats generation failed for %s: %v", date.Format("2006-01-02"), err)
		}
	}

	// Generate hotspots
	count, err := s.GenerateHotspotsFromStops(ctx, 1)
	if err != nil {
		log.Printf("[ANALYTICS] Hotspot generation failed: %v", err)
	} else {
		log.Printf("[ANALYTICS] Generated %d hotspots", count)
	}

	// Generate route segments
	routeCount, err := s.GenerateRouteSegments(ctx)
	if err != nil {
		log.Printf("[ANALYTICS] Route segment generation failed: %v", err)
	} else {
		log.Printf("[ANALYTICS] Generated %d route segments", routeCount)
	}

	log.Println("[ANALYTICS] Analytics generation completed")
	return nil
}
