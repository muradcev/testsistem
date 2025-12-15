package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// GeocodingResult represents the result of a reverse geocoding lookup
type GeocodingResult struct {
	Province string
	District string
	Address  string
}

// GeocodingService provides reverse geocoding functionality
type GeocodingService struct {
	client *http.Client
	cache  map[string]*GeocodingResult
	mu     sync.RWMutex
}

func NewGeocodingService() *GeocodingService {
	return &GeocodingService{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		cache: make(map[string]*GeocodingResult),
	}
}

// ReverseGeocode converts coordinates to address information
func (s *GeocodingService) ReverseGeocode(ctx context.Context, lat, lon float64) (*GeocodingResult, error) {
	// Create cache key (round to 4 decimal places for caching ~10m accuracy)
	cacheKey := fmt.Sprintf("%.4f,%.4f", lat, lon)

	// Check cache first
	s.mu.RLock()
	if result, ok := s.cache[cacheKey]; ok {
		s.mu.RUnlock()
		return result, nil
	}
	s.mu.RUnlock()

	// Call OpenStreetMap Nominatim API
	url := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f&addressdetails=1&accept-language=tr",
		lat, lon,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Required by Nominatim usage policy
	req.Header.Set("User-Agent", "Nakliyeo-Mobil/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("geocoding API returned status %d", resp.StatusCode)
	}

	var nominatimResp struct {
		DisplayName string `json:"display_name"`
		Address     struct {
			Province     string `json:"province"`
			State        string `json:"state"`
			City         string `json:"city"`
			Town         string `json:"town"`
			County       string `json:"county"`
			Municipality string `json:"municipality"`
			District     string `json:"district"`
			Suburb       string `json:"suburb"`
			Village      string `json:"village"`
			Road         string `json:"road"`
		} `json:"address"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&nominatimResp); err != nil {
		return nil, err
	}

	// Extract province (il)
	province := nominatimResp.Address.Province
	if province == "" {
		province = nominatimResp.Address.State
	}

	// Extract district (ilçe)
	district := nominatimResp.Address.District
	if district == "" {
		district = nominatimResp.Address.County
	}
	if district == "" {
		district = nominatimResp.Address.Town
	}
	if district == "" {
		district = nominatimResp.Address.Municipality
	}
	if district == "" {
		district = nominatimResp.Address.City
	}

	result := &GeocodingResult{
		Province: province,
		District: district,
		Address:  nominatimResp.DisplayName,
	}

	// Cache the result
	s.mu.Lock()
	s.cache[cacheKey] = result
	s.mu.Unlock()

	return result, nil
}

// ReverseGeocodeAsync performs reverse geocoding without blocking
// Returns empty result on error (non-critical operation)
func (s *GeocodingService) ReverseGeocodeAsync(lat, lon float64) *GeocodingResult {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := s.ReverseGeocode(ctx, lat, lon)
	if err != nil {
		return &GeocodingResult{}
	}
	return result
}
