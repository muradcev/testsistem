package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"
)

// RoutingService - OSRM tabanlı karayolu mesafe hesaplama servisi
type RoutingService struct {
	osrmBaseURL string
	httpClient  *http.Client
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

// RouteResult - Rota hesaplama sonucu
type RouteResult struct {
	DistanceMeters float64 `json:"distance_meters"`
	DistanceKm     float64 `json:"distance_km"`
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

// IsAvailable checks if OSRM service is available
func (s *RoutingService) IsAvailable(ctx context.Context) bool {
	url := fmt.Sprintf("%s/health", s.osrmBaseURL)

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
	// Try OSRM first
	result, err := s.GetRouteDistance(ctx, fromLat, fromLon, toLat, toLon)
	if err == nil {
		return result.DistanceKm, true, nil // true = road distance
	}

	// Fallback to Haversine (straight line)
	distance := haversineKm(fromLat, fromLon, toLat, toLon)
	return distance, false, nil // false = straight line distance
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
