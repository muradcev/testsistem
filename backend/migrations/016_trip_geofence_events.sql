-- Sefer Eventleri Tablosu
-- Akıllı sefer algılama sistemi için sefer başlangıç/bitiş eventlerini kaydeder
CREATE TABLE IF NOT EXISTS trip_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('trip_started', 'trip_ended')),

    -- Konum bilgisi
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    -- Zaman bilgileri
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,

    -- Sefer istatistikleri (trip_ended için)
    total_distance_km DOUBLE PRECISION,
    avg_speed_kmh DOUBLE PRECISION,
    max_speed_kmh DOUBLE PRECISION,
    trip_type VARCHAR(20), -- city, highway, longHaul
    duration_minutes INTEGER,

    -- Başlangıç konumu (trip_ended için)
    start_latitude DOUBLE PRECISION,
    start_longitude DOUBLE PRECISION,
    straight_line_distance_km DOUBLE PRECISION,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_trip_events_driver_id ON trip_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_events_event_type ON trip_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trip_events_created_at ON trip_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_events_driver_created ON trip_events(driver_id, created_at DESC);

-- Geofence Bölgeleri Tablosu
-- Depo, müşteri, liman, fabrika, dinlenme alanı gibi önemli lokasyonlar
CREATE TABLE IF NOT EXISTS geofence_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('warehouse', 'customer', 'port', 'factory', 'rest_area', 'gas_station', 'customs', 'other')),

    -- Konum ve yarıçap
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters DOUBLE PRECISION NOT NULL DEFAULT 200,

    -- Ek bilgiler
    description TEXT,
    address TEXT,
    city VARCHAR(100),

    -- Durum
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geofence İndeksleri
CREATE INDEX IF NOT EXISTS idx_geofence_zones_type ON geofence_zones(type);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON geofence_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_location ON geofence_zones(latitude, longitude);

-- Geofence Eventleri Tablosu
-- Şoförlerin geofence bölgelerine giriş/çıkış kayıtları
CREATE TABLE IF NOT EXISTS geofence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES geofence_zones(id) ON DELETE CASCADE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entered', 'exited')),

    -- Event anındaki konum
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geofence Event İndeksleri
CREATE INDEX IF NOT EXISTS idx_geofence_events_driver_id ON geofence_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_zone_id ON geofence_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_created_at ON geofence_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_driver_zone ON geofence_events(driver_id, zone_id, created_at DESC);

-- Örnek geofence bölgeleri ekle
INSERT INTO geofence_zones (name, type, latitude, longitude, radius_meters, description, city)
VALUES
    ('İstanbul Ambarlı Limanı', 'port', 41.0082, 28.6990, 500, 'Türkiye''nin en büyük konteyner limanı', 'İstanbul'),
    ('Ankara Lojistik Merkezi', 'warehouse', 39.9334, 32.8597, 300, 'Merkez depo', 'Ankara'),
    ('İzmir Alsancak Limanı', 'port', 38.4337, 27.1340, 400, 'İzmir ana limanı', 'İzmir'),
    ('Mersin Limanı', 'port', 36.7900, 34.6397, 500, 'Akdeniz ana limanı', 'Mersin'),
    ('Habur Sınır Kapısı', 'customs', 37.1378, 42.6928, 1000, 'Irak sınır kapısı', 'Şırnak')
ON CONFLICT DO NOTHING;

-- Yorum: Bu tablolar mobil uygulamadaki akıllı sefer algılama ve geofencing sistemi için kullanılır.
-- TripDetectionService şoförün hareketlerini izler ve otomatik olarak sefer başlangıç/bitişi algılar.
-- GeofenceService belirli bölgelere giriş/çıkışları tespit eder.
