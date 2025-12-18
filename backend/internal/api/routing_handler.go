package api

import (
	"net/http"
	"strconv"

	"nakliyeo-mobil/internal/service"

	"github.com/gin-gonic/gin"
)

type RoutingHandler struct {
	routingService *service.RoutingService
}

func NewRoutingHandler(routingService *service.RoutingService) *RoutingHandler {
	return &RoutingHandler{routingService: routingService}
}

// GetRouteDistance - İki nokta arası karayolu mesafesi hesapla
// GET /api/v1/routing/distance?from_lat=39.9334&from_lon=32.8597&to_lat=41.0082&to_lon=29.0121
func (h *RoutingHandler) GetRouteDistance(c *gin.Context) {
	fromLat, err := strconv.ParseFloat(c.Query("from_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lat geçersiz"})
		return
	}

	fromLon, err := strconv.ParseFloat(c.Query("from_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lon geçersiz"})
		return
	}

	toLat, err := strconv.ParseFloat(c.Query("to_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lat geçersiz"})
		return
	}

	toLon, err := strconv.ParseFloat(c.Query("to_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lon geçersiz"})
		return
	}

	result, err := h.routingService.GetRouteDistance(c.Request.Context(), fromLat, fromLon, toLat, toLon)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"from": gin.H{
			"latitude":  fromLat,
			"longitude": fromLon,
		},
		"to": gin.H{
			"latitude":  toLat,
			"longitude": toLon,
		},
		"distance_km":      result.DistanceKm,
		"distance_meters":  result.DistanceMeters,
		"duration_minutes": result.DurationMinutes,
		"duration_seconds": result.DurationSeconds,
	})
}

// GetRouteDistanceWithFallback - Karayolu mesafesi, OSRM çalışmazsa Haversine kullan
func (h *RoutingHandler) GetRouteDistanceWithFallback(c *gin.Context) {
	fromLat, err := strconv.ParseFloat(c.Query("from_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lat geçersiz"})
		return
	}

	fromLon, err := strconv.ParseFloat(c.Query("from_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_lon geçersiz"})
		return
	}

	toLat, err := strconv.ParseFloat(c.Query("to_lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lat geçersiz"})
		return
	}

	toLon, err := strconv.ParseFloat(c.Query("to_lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_lon geçersiz"})
		return
	}

	distance, isRoadDistance, err := h.routingService.CalculateRouteDistanceWithFallback(c.Request.Context(), fromLat, fromLon, toLat, toLon)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	distanceType := "road"
	if !isRoadDistance {
		distanceType = "straight_line"
	}

	c.JSON(http.StatusOK, gin.H{
		"from": gin.H{
			"latitude":  fromLat,
			"longitude": fromLon,
		},
		"to": gin.H{
			"latitude":  toLat,
			"longitude": toLon,
		},
		"distance_km":   distance,
		"distance_type": distanceType,
	})
}

// CheckOSRMStatus - OSRM sunucusunun durumunu kontrol et
func (h *RoutingHandler) CheckOSRMStatus(c *gin.Context) {
	available := h.routingService.IsAvailable(c.Request.Context())

	status := "unavailable"
	if available {
		status = "available"
	}

	// Cache istatistikleri
	cacheStats, _ := h.routingService.GetCacheStats(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"osrm_status":   status,
		"available":     available,
		"cache_enabled": cacheStats != nil && cacheStats.CacheEnabled,
		"cached_routes": func() int64 {
			if cacheStats != nil {
				return cacheStats.CachedRoutes
			}
			return 0
		}(),
	})
}

// GetProvinceDistance - İller arası mesafe hesapla (il adları ile)
// GET /api/v1/admin/routing/province-distance?origin=Ankara&destination=İstanbul
func (h *RoutingHandler) GetProvinceDistance(c *gin.Context) {
	origin := c.Query("origin")
	dest := c.Query("destination")

	if origin == "" || dest == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "origin ve destination parametreleri gerekli"})
		return
	}

	// İl koordinatlarını al (data paketinden)
	// Bu endpoint için basit bir response döneceğiz
	// Asıl hesaplama TransportService üzerinden yapılıyor

	c.JSON(http.StatusOK, gin.H{
		"origin":      origin,
		"destination": dest,
		"message":     "İl bazlı mesafe hesaplama transport kayıtlarında otomatik yapılır",
	})
}

// GetCacheStats - Cache istatistiklerini döndür
// GET /api/v1/admin/routing/cache-stats
func (h *RoutingHandler) GetCacheStats(c *gin.Context) {
	stats, err := h.routingService.GetCacheStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cache_enabled": stats.CacheEnabled,
		"cached_routes": stats.CachedRoutes,
		"cache_ttl":     "7 days",
	})
}

// ClearCache - Cache'i temizle
// DELETE /api/v1/admin/routing/cache
func (h *RoutingHandler) ClearCache(c *gin.Context) {
	err := h.routingService.ClearCache(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cache temizlendi",
	})
}

// BatchDistanceRequest - Toplu mesafe hesaplama isteği
type BatchDistanceRequest struct {
	Origins      []CoordinateRequest `json:"origins" binding:"required"`
	Destinations []CoordinateRequest `json:"destinations" binding:"required"`
}

// CoordinateRequest - Koordinat isteği
type CoordinateRequest struct {
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	Name      string  `json:"name"`
}

// GetBatchDistances - Toplu mesafe hesaplama
// POST /api/v1/admin/routing/batch
// Body: { "origins": [{lat, lon, name}], "destinations": [{lat, lon, name}] }
func (h *RoutingHandler) GetBatchDistances(c *gin.Context) {
	var req BatchDistanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek: " + err.Error()})
		return
	}

	if len(req.Origins) == 0 || len(req.Destinations) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az 1 origin ve 1 destination gerekli"})
		return
	}

	if len(req.Origins) > 50 || len(req.Destinations) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maksimum 50 origin ve 50 destination"})
		return
	}

	// Convert to service types
	origins := make([]service.Coordinate, len(req.Origins))
	for i, o := range req.Origins {
		origins[i] = service.Coordinate{
			Latitude:  o.Latitude,
			Longitude: o.Longitude,
			Name:      o.Name,
		}
	}

	destinations := make([]service.Coordinate, len(req.Destinations))
	for i, d := range req.Destinations {
		destinations[i] = service.Coordinate{
			Latitude:  d.Latitude,
			Longitude: d.Longitude,
			Name:      d.Name,
		}
	}

	result, err := h.routingService.GetBatchDistances(c.Request.Context(), origins, destinations)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ProvinceDistanceRequest - İl bazlı mesafe isteği
type ProvinceDistanceRequest struct {
	Provinces []string `json:"provinces" binding:"required"`
}

// GetProvinceDistanceMatrix - İller arası mesafe matrisi
// POST /api/v1/admin/routing/province-matrix
// Body: { "provinces": ["İstanbul", "Ankara", "İzmir"] }
func (h *RoutingHandler) GetProvinceDistanceMatrix(c *gin.Context) {
	var req ProvinceDistanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek: " + err.Error()})
		return
	}

	if len(req.Provinces) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "En az 2 il gerekli"})
		return
	}

	if len(req.Provinces) > 81 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maksimum 81 il"})
		return
	}

	// İl koordinatlarını al
	provinceCoords := getProvinceCoordinates()

	// Koordinat slice'ı oluştur
	coordinates := make([]service.Coordinate, 0, len(req.Provinces))
	for _, prov := range req.Provinces {
		if coord, ok := provinceCoords[prov]; ok {
			coordinates = append(coordinates, service.Coordinate{
				Latitude:  coord.Latitude,
				Longitude: coord.Longitude,
				Name:      prov,
			})
		}
	}

	if len(coordinates) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz il adları"})
		return
	}

	// Matrix hesapla (NxN)
	result, err := h.routingService.GetBatchDistances(c.Request.Context(), coordinates, coordinates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ProvinceCoord - İl koordinatı
type ProvinceCoord struct {
	Latitude  float64
	Longitude float64
}

// getProvinceCoordinates - 81 il koordinatları
func getProvinceCoordinates() map[string]ProvinceCoord {
	return map[string]ProvinceCoord{
		"Adana":          {Latitude: 37.0000, Longitude: 35.3213},
		"Adıyaman":       {Latitude: 37.7648, Longitude: 38.2786},
		"Afyonkarahisar": {Latitude: 38.7507, Longitude: 30.5567},
		"Ağrı":           {Latitude: 39.7191, Longitude: 43.0503},
		"Aksaray":        {Latitude: 38.3687, Longitude: 34.0370},
		"Amasya":         {Latitude: 40.6499, Longitude: 35.8353},
		"Ankara":         {Latitude: 39.9334, Longitude: 32.8597},
		"Antalya":        {Latitude: 36.8969, Longitude: 30.7133},
		"Ardahan":        {Latitude: 41.1105, Longitude: 42.7022},
		"Artvin":         {Latitude: 41.1828, Longitude: 41.8183},
		"Aydın":          {Latitude: 37.8560, Longitude: 27.8416},
		"Balıkesir":      {Latitude: 39.6484, Longitude: 27.8826},
		"Bartın":         {Latitude: 41.6344, Longitude: 32.3375},
		"Batman":         {Latitude: 37.8812, Longitude: 41.1351},
		"Bayburt":        {Latitude: 40.2552, Longitude: 40.2249},
		"Bilecik":        {Latitude: 40.0567, Longitude: 30.0665},
		"Bingöl":         {Latitude: 38.8854, Longitude: 40.4966},
		"Bitlis":         {Latitude: 38.4006, Longitude: 42.1095},
		"Bolu":           {Latitude: 40.7392, Longitude: 31.6089},
		"Burdur":         {Latitude: 37.7203, Longitude: 30.2906},
		"Bursa":          {Latitude: 40.1826, Longitude: 29.0665},
		"Çanakkale":      {Latitude: 40.1553, Longitude: 26.4142},
		"Çankırı":        {Latitude: 40.6013, Longitude: 33.6134},
		"Çorum":          {Latitude: 40.5506, Longitude: 34.9556},
		"Denizli":        {Latitude: 37.7765, Longitude: 29.0864},
		"Diyarbakır":     {Latitude: 37.9144, Longitude: 40.2306},
		"Düzce":          {Latitude: 40.8438, Longitude: 31.1565},
		"Edirne":         {Latitude: 41.6818, Longitude: 26.5623},
		"Elazığ":         {Latitude: 38.6810, Longitude: 39.2264},
		"Erzincan":       {Latitude: 39.7500, Longitude: 39.5000},
		"Erzurum":        {Latitude: 39.9000, Longitude: 41.2700},
		"Eskişehir":      {Latitude: 39.7767, Longitude: 30.5206},
		"Gaziantep":      {Latitude: 37.0662, Longitude: 37.3833},
		"Giresun":        {Latitude: 40.9128, Longitude: 38.3895},
		"Gümüşhane":      {Latitude: 40.4386, Longitude: 39.5086},
		"Hakkari":        {Latitude: 37.5833, Longitude: 43.7333},
		"Hatay":          {Latitude: 36.4018, Longitude: 36.3498},
		"Iğdır":          {Latitude: 39.9237, Longitude: 44.0450},
		"Isparta":        {Latitude: 37.7648, Longitude: 30.5566},
		"İstanbul":       {Latitude: 41.0082, Longitude: 29.0121},
		"İzmir":          {Latitude: 38.4237, Longitude: 27.1428},
		"Kahramanmaraş":  {Latitude: 37.5858, Longitude: 36.9371},
		"Karabük":        {Latitude: 41.2061, Longitude: 32.6204},
		"Karaman":        {Latitude: 37.1759, Longitude: 33.2287},
		"Kars":           {Latitude: 40.6167, Longitude: 43.1000},
		"Kastamonu":      {Latitude: 41.3887, Longitude: 33.7827},
		"Kayseri":        {Latitude: 38.7312, Longitude: 35.4787},
		"Kırıkkale":      {Latitude: 39.8468, Longitude: 33.5153},
		"Kırklareli":     {Latitude: 41.7333, Longitude: 27.2167},
		"Kırşehir":       {Latitude: 39.1425, Longitude: 34.1709},
		"Kilis":          {Latitude: 36.7184, Longitude: 37.1212},
		"Kocaeli":        {Latitude: 40.8533, Longitude: 29.8815},
		"Konya":          {Latitude: 37.8746, Longitude: 32.4932},
		"Kütahya":        {Latitude: 39.4167, Longitude: 29.9833},
		"Malatya":        {Latitude: 38.3552, Longitude: 38.3095},
		"Manisa":         {Latitude: 38.6191, Longitude: 27.4289},
		"Mardin":         {Latitude: 37.3212, Longitude: 40.7245},
		"Mersin":         {Latitude: 36.8000, Longitude: 34.6333},
		"Muğla":          {Latitude: 37.2153, Longitude: 28.3636},
		"Muş":            {Latitude: 38.9462, Longitude: 41.7539},
		"Nevşehir":       {Latitude: 38.6939, Longitude: 34.6857},
		"Niğde":          {Latitude: 37.9667, Longitude: 34.6833},
		"Ordu":           {Latitude: 40.9839, Longitude: 37.8764},
		"Osmaniye":       {Latitude: 37.0742, Longitude: 36.2472},
		"Rize":           {Latitude: 41.0201, Longitude: 40.5234},
		"Sakarya":        {Latitude: 40.6940, Longitude: 30.4358},
		"Samsun":         {Latitude: 41.2867, Longitude: 36.33},
		"Siirt":          {Latitude: 37.9333, Longitude: 41.9500},
		"Sinop":          {Latitude: 42.0231, Longitude: 35.1531},
		"Sivas":          {Latitude: 39.7477, Longitude: 37.0179},
		"Şanlıurfa":      {Latitude: 37.1591, Longitude: 38.7969},
		"Şırnak":         {Latitude: 37.5164, Longitude: 42.4611},
		"Tekirdağ":       {Latitude: 40.9833, Longitude: 27.5167},
		"Tokat":          {Latitude: 40.3167, Longitude: 36.5500},
		"Trabzon":        {Latitude: 41.0015, Longitude: 39.7178},
		"Tunceli":        {Latitude: 39.1079, Longitude: 39.5401},
		"Uşak":           {Latitude: 38.6823, Longitude: 29.4082},
		"Van":            {Latitude: 38.4891, Longitude: 43.4089},
		"Yalova":         {Latitude: 40.6500, Longitude: 29.2667},
		"Yozgat":         {Latitude: 39.8181, Longitude: 34.8147},
		"Zonguldak":      {Latitude: 41.4564, Longitude: 31.7987},
	}
}
