package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// RoutingService - OSRM tabanlı karayolu mesafe hesaplama servisi (Redis cache ile)
type RoutingService struct {
	osrmBaseURL string
	httpClient  *http.Client
	redisClient *redis.Client
}

// CacheStats - Cache istatistikleri
type CacheStats struct {
	Hits   int64 `json:"hits"`
	Misses int64 `json:"misses"`
}

// RoutingServiceStats - Routing service istatistikleri
type RoutingServiceStats struct {
	CacheEnabled bool  `json:"cache_enabled"`
	CachedRoutes int64 `json:"cached_routes"`
}

const (
	// Cache key prefix
	distanceCachePrefix = "distance:"

	// Cache TTL - 7 gün (yol mesafeleri nadiren değişir)
	distanceCacheTTL = 7 * 24 * time.Hour
)

// CachedDistance - Cache'lenen mesafe verisi
type CachedDistance struct {
	DistanceKm      float64 `json:"distance_km"`
	DurationMinutes float64 `json:"duration_minutes"`
	IsOSRM          bool    `json:"is_osrm"`
	CachedAt        string  `json:"cached_at"`
}

// NewRoutingService creates a new routing service
func NewRoutingService(osrmURL string) *RoutingService {
	if osrmURL == "" {
		osrmURL = "http://localhost:5000" // Default local OSRM
	}

	return &RoutingService{
		osrmBaseURL: osrmURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NewRoutingServiceWithRedis creates a routing service with Redis caching
func NewRoutingServiceWithRedis(osrmURL string, redisClient *redis.Client) *RoutingService {
	rs := NewRoutingService(osrmURL)
	rs.redisClient = redisClient
	return rs
}

// SetRedisClient - Redis client'ı sonradan set et
func (s *RoutingService) SetRedisClient(client *redis.Client) {
	s.redisClient = client
}

// RouteResult - Rota hesaplama sonucu
type RouteResult struct {
	DistanceMeters  float64 `json:"distance_meters"`
	DistanceKm      float64 `json:"distance_km"`
	DurationSeconds float64 `json:"duration_seconds"`
	DurationMinutes float64 `json:"duration_minutes"`
}

// OSRMResponse - OSRM API yanıtı
type OSRMResponse struct {
	Code   string `json:"code"`
	Routes []struct {
		Distance float64 `json:"distance"` // metres
		Duration float64 `json:"duration"` // seconds
	} `json:"routes"`
	Message string `json:"message,omitempty"`
}

// generateCacheKey - Cache key oluştur (sıralı, yön bağımsız değil)
func generateCacheKey(fromLat, fromLon, toLat, toLon float64) string {
	// 4 ondalık hassasiyet (~11m hassasiyet, şehir merkezleri için yeterli)
	return fmt.Sprintf("%s%.4f,%.4f:%.4f,%.4f", distanceCachePrefix, fromLat, fromLon, toLat, toLon)
}

// generateProvinceCacheKey - İl bazlı cache key (daha kısa key)
func generateProvinceCacheKey(originProvince, destProvince string) string {
	return fmt.Sprintf("%sprovinces:%s:%s", distanceCachePrefix, originProvince, destProvince)
}

// getCachedDistance - Cache'den mesafe al
func (s *RoutingService) getCachedDistance(ctx context.Context, key string) (*CachedDistance, error) {
	if s.redisClient == nil {
		return nil, nil
	}

	data, err := s.redisClient.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // Cache miss
	}
	if err != nil {
		return nil, err
	}

	var cached CachedDistance
	if err := json.Unmarshal(data, &cached); err != nil {
		return nil, err
	}

	return &cached, nil
}

// setCachedDistance - Cache'e mesafe kaydet
func (s *RoutingService) setCachedDistance(ctx context.Context, key string, distance *CachedDistance) error {
	if s.redisClient == nil {
		return nil
	}

	distance.CachedAt = time.Now().Format(time.RFC3339)
	data, err := json.Marshal(distance)
	if err != nil {
		return err
	}

	return s.redisClient.Set(ctx, key, data, distanceCacheTTL).Err()
}

// GetRouteDistance calculates the road distance between two points
func (s *RoutingService) GetRouteDistance(ctx context.Context, fromLat, fromLon, toLat, toLon float64) (*RouteResult, error) {
	// OSRM expects coordinates in lon,lat format
	url := fmt.Sprintf("%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=false",
		s.osrmBaseURL, fromLon, fromLat, toLon, toLat)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OSRM request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OSRM returned status %d", resp.StatusCode)
	}

	var osrmResp OSRMResponse
	if err := json.NewDecoder(resp.Body).Decode(&osrmResp); err != nil {
		return nil, fmt.Errorf("failed to decode OSRM response: %w", err)
	}

	if osrmResp.Code != "Ok" {
		return nil, fmt.Errorf("OSRM error: %s - %s", osrmResp.Code, osrmResp.Message)
	}

	if len(osrmResp.Routes) == 0 {
		return nil, fmt.Errorf("no route found")
	}

	route := osrmResp.Routes[0]
	return &RouteResult{
		DistanceMeters:  route.Distance,
		DistanceKm:      route.Distance / 1000,
		DurationSeconds: route.Duration,
		DurationMinutes: route.Duration / 60,
	}, nil
}

// GetRouteDistanceWithCache - Cache ile mesafe hesapla
func (s *RoutingService) GetRouteDistanceWithCache(ctx context.Context, fromLat, fromLon, toLat, toLon float64) (*RouteResult, bool, error) {
	cacheKey := generateCacheKey(fromLat, fromLon, toLat, toLon)

	// Cache'den kontrol
	cached, err := s.getCachedDistance(ctx, cacheKey)
	if err == nil && cached != nil {
		return &RouteResult{
			DistanceKm:      cached.DistanceKm,
			DurationMinutes: cached.DurationMinutes,
			DistanceMeters:  cached.DistanceKm * 1000,
			DurationSeconds: cached.DurationMinutes * 60,
		}, true, nil // true = cache hit
	}

	// OSRM'den al
	result, err := s.GetRouteDistance(ctx, fromLat, fromLon, toLat, toLon)
	if err != nil {
		return nil, false, err
	}

	// Cache'e kaydet
	_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
		DistanceKm:      result.DistanceKm,
		DurationMinutes: result.DurationMinutes,
		IsOSRM:          true,
	})

	return result, false, nil // false = cache miss
}

// GetProvinceDistance - İller arası mesafe (cache ile)
func (s *RoutingService) GetProvinceDistance(ctx context.Context, originProvince, destProvince string, fromLat, fromLon, toLat, toLon float64) (*RouteResult, bool, error) {
	cacheKey := generateProvinceCacheKey(originProvince, destProvince)

	// Cache'den kontrol
	cached, err := s.getCachedDistance(ctx, cacheKey)
	if err == nil && cached != nil {
		return &RouteResult{
			DistanceKm:      cached.DistanceKm,
			DurationMinutes: cached.DurationMinutes,
			DistanceMeters:  cached.DistanceKm * 1000,
			DurationSeconds: cached.DurationMinutes * 60,
		}, true, nil // true = cache hit
	}

	// OSRM'den al
	result, err := s.GetRouteDistance(ctx, fromLat, fromLon, toLat, toLon)
	if err != nil {
		return nil, false, err
	}

	// Cache'e kaydet (il bazlı key ile)
	_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
		DistanceKm:      result.DistanceKm,
		DurationMinutes: result.DurationMinutes,
		IsOSRM:          true,
	})

	return result, false, nil
}

// GetMultiPointDistance calculates total road distance through multiple points
func (s *RoutingService) GetMultiPointDistance(ctx context.Context, points [][]float64) (*RouteResult, error) {
	if len(points) < 2 {
		return &RouteResult{}, nil
	}

	// Build coordinates string: lon1,lat1;lon2,lat2;...
	coords := ""
	for i, point := range points {
		if i > 0 {
			coords += ";"
		}
		coords += fmt.Sprintf("%.6f,%.6f", point[1], point[0]) // lon,lat
	}

	url := fmt.Sprintf("%s/route/v1/driving/%s?overview=false", s.osrmBaseURL, coords)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OSRM request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OSRM returned status %d", resp.StatusCode)
	}

	var osrmResp OSRMResponse
	if err := json.NewDecoder(resp.Body).Decode(&osrmResp); err != nil {
		return nil, fmt.Errorf("failed to decode OSRM response: %w", err)
	}

	if osrmResp.Code != "Ok" {
		return nil, fmt.Errorf("OSRM error: %s", osrmResp.Code)
	}

	if len(osrmResp.Routes) == 0 {
		return nil, fmt.Errorf("no route found")
	}

	route := osrmResp.Routes[0]
	return &RouteResult{
		DistanceMeters:  route.Distance,
		DistanceKm:      route.Distance / 1000,
		DurationSeconds: route.Duration,
		DurationMinutes: route.Duration / 60,
	}, nil
}

// IsAvailable checks if OSRM service is available by making a simple route query
func (s *RoutingService) IsAvailable(ctx context.Context) bool {
	// OSRM doesn't have /health endpoint, test with a simple route query
	url := fmt.Sprintf("%s/route/v1/driving/32.8597,39.9334;29.0121,41.0082?overview=false", s.osrmBaseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// CalculateRouteDistanceWithFallback tries OSRM first, falls back to Haversine
func (s *RoutingService) CalculateRouteDistanceWithFallback(ctx context.Context, fromLat, fromLon, toLat, toLon float64) (float64, bool, error) {
	cacheKey := generateCacheKey(fromLat, fromLon, toLat, toLon)

	// Cache'den kontrol
	cached, err := s.getCachedDistance(ctx, cacheKey)
	if err == nil && cached != nil {
		return cached.DistanceKm, cached.IsOSRM, nil
	}

	// Try OSRM first
	result, err := s.GetRouteDistance(ctx, fromLat, fromLon, toLat, toLon)
	if err == nil {
		// Cache'e kaydet
		_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
			DistanceKm:      result.DistanceKm,
			DurationMinutes: result.DurationMinutes,
			IsOSRM:          true,
		})
		return result.DistanceKm, true, nil // true = road distance
	}

	// Fallback to Haversine (straight line)
	distance := haversineKm(fromLat, fromLon, toLat, toLon)

	// Haversine sonucunu da cache'le (OSRM down olabilir)
	_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
		DistanceKm:      distance,
		DurationMinutes: 0, // Haversine süre hesaplamaz
		IsOSRM:          false,
	})

	return distance, false, nil // false = straight line distance
}

// CalculateProvinceDistanceWithFallback - İl bazlı cache ile mesafe hesapla
func (s *RoutingService) CalculateProvinceDistanceWithFallback(ctx context.Context, originProvince, destProvince string, fromLat, fromLon, toLat, toLon float64) (float64, bool, error) {
	cacheKey := generateProvinceCacheKey(originProvince, destProvince)

	// Cache'den kontrol
	cached, err := s.getCachedDistance(ctx, cacheKey)
	if err == nil && cached != nil {
		return cached.DistanceKm, cached.IsOSRM, nil
	}

	// Try OSRM first
	result, err := s.GetRouteDistance(ctx, fromLat, fromLon, toLat, toLon)
	if err == nil {
		// Cache'e kaydet (il bazlı key ile)
		_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
			DistanceKm:      result.DistanceKm,
			DurationMinutes: result.DurationMinutes,
			IsOSRM:          true,
		})
		return result.DistanceKm, true, nil
	}

	// Fallback to Haversine
	distance := haversineKm(fromLat, fromLon, toLat, toLon)

	// Cache'le
	_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
		DistanceKm: distance,
		IsOSRM:     false,
	})

	return distance, false, nil
}

// GetCacheStats - Cache istatistikleri
func (s *RoutingService) GetCacheStats(ctx context.Context) (*RoutingServiceStats, error) {
	stats := &RoutingServiceStats{
		CacheEnabled: s.redisClient != nil,
	}

	if s.redisClient == nil {
		return stats, nil
	}

	// Distance cache'deki key sayısını al
	keys, err := s.redisClient.Keys(ctx, distanceCachePrefix+"*").Result()
	if err == nil {
		stats.CachedRoutes = int64(len(keys))
	}

	return stats, nil
}

// ClearCache - Cache'i temizle
func (s *RoutingService) ClearCache(ctx context.Context) error {
	if s.redisClient == nil {
		return nil
	}

	keys, err := s.redisClient.Keys(ctx, distanceCachePrefix+"*").Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return s.redisClient.Del(ctx, keys...).Err()
	}

	return nil
}

// BatchRouteRequest - Toplu mesafe hesaplama isteği
type BatchRouteRequest struct {
	Origins      []Coordinate `json:"origins"`
	Destinations []Coordinate `json:"destinations"`
}

// Coordinate - Koordinat
type Coordinate struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Name      string  `json:"name,omitempty"` // İl adı (opsiyonel)
}

// BatchRouteResult - Toplu mesafe hesaplama sonucu
type BatchRouteResult struct {
	Distances [][]DistanceEntry `json:"distances"`
	Origins   []Coordinate      `json:"origins"`
	Dests     []Coordinate      `json:"destinations"`
}

// DistanceEntry - Mesafe girişi
type DistanceEntry struct {
	DistanceKm      float64 `json:"distance_km"`
	DurationMinutes float64 `json:"duration_minutes"`
	IsOSRM          bool    `json:"is_osrm"`
	FromCache       bool    `json:"from_cache"`
}

// GetBatchDistances - Birden fazla origin-destination çifti için mesafe hesapla
func (s *RoutingService) GetBatchDistances(ctx context.Context, origins, destinations []Coordinate) (*BatchRouteResult, error) {
	result := &BatchRouteResult{
		Origins:   origins,
		Dests:     destinations,
		Distances: make([][]DistanceEntry, len(origins)),
	}

	// Her origin için her destination'a mesafe hesapla
	for i, origin := range origins {
		result.Distances[i] = make([]DistanceEntry, len(destinations))
		for j, dest := range destinations {
			// Cache key (koordinat bazlı)
			cacheKey := generateCacheKey(origin.Latitude, origin.Longitude, dest.Latitude, dest.Longitude)

			// Cache'den kontrol
			cached, err := s.getCachedDistance(ctx, cacheKey)
			if err == nil && cached != nil {
				result.Distances[i][j] = DistanceEntry{
					DistanceKm:      cached.DistanceKm,
					DurationMinutes: cached.DurationMinutes,
					IsOSRM:          cached.IsOSRM,
					FromCache:       true,
				}
				continue
			}

			// OSRM'den al
			osrmResult, err := s.GetRouteDistance(ctx, origin.Latitude, origin.Longitude, dest.Latitude, dest.Longitude)
			if err == nil {
				entry := DistanceEntry{
					DistanceKm:      osrmResult.DistanceKm,
					DurationMinutes: osrmResult.DurationMinutes,
					IsOSRM:          true,
					FromCache:       false,
				}
				result.Distances[i][j] = entry

				// Cache'e kaydet
				_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
					DistanceKm:      osrmResult.DistanceKm,
					DurationMinutes: osrmResult.DurationMinutes,
					IsOSRM:          true,
				})
			} else {
				// Haversine fallback
				distance := haversineKm(origin.Latitude, origin.Longitude, dest.Latitude, dest.Longitude)
				entry := DistanceEntry{
					DistanceKm:      distance,
					DurationMinutes: 0,
					IsOSRM:          false,
					FromCache:       false,
				}
				result.Distances[i][j] = entry

				// Cache'e kaydet
				_ = s.setCachedDistance(ctx, cacheKey, &CachedDistance{
					DistanceKm: distance,
					IsOSRM:     false,
				})
			}
		}
	}

	return result, nil
}

// GetProvinceDistanceMatrix - İl bazlı mesafe matrisi (il isimleri ile)
func (s *RoutingService) GetProvinceDistanceMatrix(ctx context.Context, provinces []string, provinceCoords map[string]Coordinate) (*BatchRouteResult, error) {
	coordinates := make([]Coordinate, len(provinces))
	for i, prov := range provinces {
		if coord, ok := provinceCoords[prov]; ok {
			coordinates[i] = coord
			coordinates[i].Name = prov
		}
	}

	// Aynı origin ve destination listesi (NxN matrix)
	return s.GetBatchDistances(ctx, coordinates, coordinates)
}

// haversineKm calculates straight-line distance in kilometers
func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in km

	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
