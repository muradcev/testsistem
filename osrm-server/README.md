# OSRM Server - Türkiye Karayolu Mesafe Hesaplama

Bu servis, Türkiye için karayolu mesafesi hesaplama sağlar.

## Özellikler
- Gerçek karayolu mesafesi hesaplama
- Seyahat süresi tahmini
- Rota bilgisi

## API Kullanımı

### Route API (İki nokta arası rota)
```
GET /route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false
```

Örnek:
```bash
curl "http://localhost:5000/route/v1/driving/43.0605,38.0077;32.8597,39.9334?overview=false"
```

Response:
```json
{
  "routes": [{
    "distance": 850000,  // metre cinsinden
    "duration": 36000    // saniye cinsinden
  }]
}
```

### Table API (Çoklu nokta mesafe matrisi)
```
GET /table/v1/driving/{coords}?annotations=distance,duration
```

## Railway Deployment

1. Railway'de yeni service oluştur
2. GitHub repo'yu bağla (osrm-server klasörü)
3. Deploy et

NOT: İlk build 15-20 dakika sürebilir (Türkiye harita verisi işleniyor)
