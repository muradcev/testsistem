-- Nakliyeo Mobil - Driver Homes and General Hotspots
-- Her şoförün kendi ev adresi (1-2 adet) ve genel durak noktaları
-- IDEMPOTENT: Bu migration birden fazla kez çalıştırılabilir

-- ============================================
-- Şoför Ev Adresleri (Her şoföre özel, max 2)
-- ============================================

CREATE TABLE IF NOT EXISTS driver_homes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Ev',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    radius DOUBLE PRECISION DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Max 2 ev kontrolü için trigger fonksiyonu
CREATE OR REPLACE FUNCTION check_driver_max_homes()
RETURNS TRIGGER AS $$
DECLARE
    home_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO home_count
    FROM driver_homes
    WHERE driver_id = NEW.driver_id;

    IF home_count >= 2 THEN
        RAISE EXCEPTION 'Bir şoför maksimum 2 ev adresi ekleyebilir';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_driver_max_homes ON driver_homes;
CREATE TRIGGER trigger_check_driver_max_homes
    BEFORE INSERT ON driver_homes
    FOR EACH ROW
    EXECUTE FUNCTION check_driver_max_homes();

CREATE INDEX IF NOT EXISTS idx_driver_homes_driver ON driver_homes(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_homes_active ON driver_homes(driver_id, is_active);
CREATE INDEX IF NOT EXISTS idx_driver_homes_location ON driver_homes(latitude, longitude);

-- ============================================
-- Genel Durak Noktaları (Hotspots)
-- ============================================

CREATE TABLE IF NOT EXISTS general_hotspots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(30) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    radius DOUBLE PRECISION DEFAULT 200,
    visit_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotspots_type ON general_hotspots(location_type);
CREATE INDEX IF NOT EXISTS idx_hotspots_location ON general_hotspots(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hotspots_province ON general_hotspots(province);
CREATE INDEX IF NOT EXISTS idx_hotspots_verified ON general_hotspots(is_verified);
CREATE INDEX IF NOT EXISTS idx_hotspots_visits ON general_hotspots(visit_count DESC);

-- ============================================
-- Stops tablosuna yeni alanlar ekle
-- ============================================

ALTER TABLE stops ADD COLUMN IF NOT EXISTS is_driver_specific BOOLEAN DEFAULT false;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS hotspot_id UUID REFERENCES general_hotspots(id);

CREATE INDEX IF NOT EXISTS idx_stops_hotspot ON stops(hotspot_id);
CREATE INDEX IF NOT EXISTS idx_stops_driver_specific ON stops(is_driver_specific);

-- ============================================
-- Mesafe hesaplama fonksiyonu
-- ============================================

CREATE OR REPLACE FUNCTION calculate_distance_meters(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);

    a := SIN(dlat/2) * SIN(dlat/2) +
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
         SIN(dlon/2) * SIN(dlon/2);

    c := 2 * ATAN2(SQRT(a), SQRT(1-a));

    RETURN 6371000 * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Durak Tipi Otomatik Tespiti
-- ============================================

CREATE OR REPLACE FUNCTION check_stop_location()
RETURNS TRIGGER AS $$
DECLARE
    home_record RECORD;
    hotspot_record RECORD;
    distance_meters DOUBLE PRECISION;
BEGIN
    -- Önce şoförün evlerini kontrol et
    FOR home_record IN
        SELECT id, latitude, longitude, radius
        FROM driver_homes
        WHERE driver_id = NEW.driver_id AND is_active = true
    LOOP
        distance_meters := calculate_distance_meters(
            home_record.latitude, home_record.longitude,
            NEW.latitude, NEW.longitude
        );

        IF distance_meters <= home_record.radius THEN
            NEW.location_type := 'home';
            NEW.is_driver_specific := true;
            RETURN NEW;
        END IF;
    END LOOP;

    -- Sonra genel hotspotları kontrol et
    FOR hotspot_record IN
        SELECT id, latitude, longitude, radius, location_type
        FROM general_hotspots
        WHERE is_verified = true
        ORDER BY visit_count DESC
        LIMIT 100
    LOOP
        distance_meters := calculate_distance_meters(
            hotspot_record.latitude, hotspot_record.longitude,
            NEW.latitude, NEW.longitude
        );

        IF distance_meters <= hotspot_record.radius THEN
            NEW.location_type := hotspot_record.location_type;
            NEW.hotspot_id := hotspot_record.id;
            NEW.is_driver_specific := false;

            UPDATE general_hotspots SET visit_count = visit_count + 1 WHERE id = hotspot_record.id;

            RETURN NEW;
        END IF;
    END LOOP;

    NEW.is_driver_specific := false;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_stop_location ON stops;
CREATE TRIGGER trigger_check_stop_location
    BEFORE INSERT ON stops
    FOR EACH ROW
    WHEN (NEW.location_type = 'unknown')
    EXECUTE FUNCTION check_stop_location();

-- ============================================
-- View'lar
-- ============================================

CREATE OR REPLACE VIEW suggested_hotspots AS
SELECT
    ROUND(latitude::numeric, 3) as grid_lat,
    ROUND(longitude::numeric, 3) as grid_lng,
    COUNT(*) as visit_count,
    COUNT(DISTINCT driver_id) as unique_drivers,
    MAX(province) as province,
    MAX(district) as district,
    AVG(duration_minutes) as avg_duration_min
FROM stops
WHERE location_type = 'unknown'
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY ROUND(latitude::numeric, 3), ROUND(longitude::numeric, 3)
HAVING COUNT(*) >= 5 AND COUNT(DISTINCT driver_id) >= 2
ORDER BY visit_count DESC
LIMIT 100;

CREATE OR REPLACE VIEW driver_home_summary AS
SELECT
    d.id as driver_id,
    d.name as driver_name,
    d.surname as driver_surname,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', dh.id,
            'name', dh.name,
            'latitude', dh.latitude,
            'longitude', dh.longitude,
            'province', dh.province,
            'district', dh.district,
            'radius', dh.radius,
            'is_active', dh.is_active
        ))
        FROM driver_homes dh
        WHERE dh.driver_id = d.id),
        '[]'::json
    ) as homes,
    (SELECT COUNT(*) FROM driver_homes dh WHERE dh.driver_id = d.id) as home_count
FROM drivers d
WHERE d.is_active = true;
