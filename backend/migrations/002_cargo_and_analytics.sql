-- Nakliyeo Mobil - Cargo, Pricing and Analytics Schema
-- Veri toplama ve analiz için ek tablolar

-- ============================================
-- Dinamik Uygulama Ayarları (App Config)
-- Admin panelden yönetilebilir seçenekler
-- ============================================

-- Yük/Kargo tipleri
CREATE TABLE cargo_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- icon ismi (mobil için)
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cargo_types_active ON cargo_types(is_active, sort_order);

-- Varsayılan yük tipleri
INSERT INTO cargo_types (name, description, icon, sort_order) VALUES
    ('Gıda', 'Gıda ve içecek ürünleri', 'food', 1),
    ('İnşaat Malzemesi', 'Çimento, demir, kum, çakıl vb.', 'construction', 2),
    ('Tarım Ürünleri', 'Tahıl, meyve, sebze vb.', 'agriculture', 3),
    ('Tekstil', 'Kumaş, hazır giyim vb.', 'textile', 4),
    ('Mobilya', 'Ev ve ofis mobilyaları', 'furniture', 5),
    ('Elektronik', 'Beyaz eşya, elektronik cihazlar', 'electronics', 6),
    ('Otomotiv', 'Araç parçaları, yedek parça', 'automotive', 7),
    ('Kimyasal', 'Kimyasal maddeler, boya vb.', 'chemical', 8),
    ('Soğuk Zincir', 'Soğutma gerektiren ürünler', 'cold_chain', 9),
    ('Tehlikeli Madde', 'ADR belgeli taşıma gerektiren', 'hazardous', 10),
    ('Konteyner', 'Konteyner taşımacılığı', 'container', 11),
    ('Canlı Hayvan', 'Canlı hayvan nakliyesi', 'livestock', 12),
    ('Kağıt/Karton', 'Kağıt ve karton ürünleri', 'paper', 13),
    ('Makine/Ekipman', 'Endüstriyel makine ve ekipman', 'machinery', 14),
    ('Diğer', 'Diğer yük tipleri', 'other', 99);

-- Araç marka ve modelleri (dinamik yönetim için)
CREATE TABLE vehicle_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vehicle_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES vehicle_brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vehicle_models_brand ON vehicle_models(brand_id);

-- Varsayılan araç markaları
INSERT INTO vehicle_brands (name, sort_order) VALUES
    ('Mercedes-Benz', 1),
    ('MAN', 2),
    ('Volvo', 3),
    ('Scania', 4),
    ('DAF', 5),
    ('Iveco', 6),
    ('Renault', 7),
    ('Ford', 8),
    ('BMC', 9),
    ('Isuzu', 10),
    ('Mitsubishi', 11),
    ('Diğer', 99);

-- Dorse tipleri (dinamik yönetim için)
CREATE TABLE trailer_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO trailer_types (name, description, sort_order) VALUES
    ('Tenteli', 'Standart tenteli dorse', 1),
    ('Kapalı Kasa', 'Kapalı kasa dorse', 2),
    ('Açık Kasa', 'Açık kasa dorse', 3),
    ('Frigo', 'Soğutmalı dorse', 4),
    ('Lowbed', 'Alçak platform dorse', 5),
    ('Konteyner', 'Konteyner taşıma dorsesi', 6),
    ('Tanker', 'Sıvı/gaz tankeri', 7),
    ('Damper', 'Damperli dorse', 8),
    ('Platform', 'Platform dorse', 9),
    ('Silobas', 'Silobas/toz taşıma', 10),
    ('Araç Taşıyıcı', 'Araç taşıma dorsesi', 11),
    ('Diğer', 'Diğer dorse tipleri', 99);

-- ============================================
-- Sefer Detayları ve Yük Bilgileri
-- ============================================

-- Sefer yük bilgileri (trips tablosuna ek olarak)
CREATE TABLE trip_cargo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    cargo_type_id UUID REFERENCES cargo_types(id),
    cargo_type_other VARCHAR(100), -- Diğer seçilirse
    weight_tons DOUBLE PRECISION, -- Tahmini ağırlık (ton)
    is_full_load BOOLEAN DEFAULT true, -- Tam yük mü, parsiyel mi
    load_percentage INTEGER, -- Doluluk yüzdesi (parsiyel için)
    description TEXT, -- Ek açıklama
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trip_cargo_trip_id ON trip_cargo(trip_id);
CREATE INDEX idx_trip_cargo_type ON trip_cargo(cargo_type_id);

-- ============================================
-- Fiyat Verileri
-- ============================================

-- Sefer fiyat bilgileri
CREATE TABLE trip_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Fiyat bilgileri
    total_price DECIMAL(12, 2), -- Toplam ücret (TL)
    currency VARCHAR(3) DEFAULT 'TRY',
    price_per_km DECIMAL(8, 2), -- Km başına ücret

    -- Fiyat tipi
    price_type VARCHAR(20) DEFAULT 'fixed', -- fixed, per_km, per_ton

    -- Ek masraflar
    fuel_cost DECIMAL(10, 2), -- Yakıt maliyeti (varsa)
    toll_cost DECIMAL(10, 2), -- Otoyol/köprü ücreti
    other_costs DECIMAL(10, 2), -- Diğer masraflar

    -- Kim ödedi
    paid_by VARCHAR(20), -- sender, receiver, broker
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid

    -- Kaynak
    source VARCHAR(20) DEFAULT 'driver_input', -- driver_input, survey, estimate

    -- Zaman
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Konum (fiyat girildiğinde neredeydi)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

CREATE INDEX idx_trip_pricing_trip ON trip_pricing(trip_id);
CREATE INDEX idx_trip_pricing_driver ON trip_pricing(driver_id);
CREATE INDEX idx_trip_pricing_recorded ON trip_pricing(recorded_at DESC);

-- Fiyat anket yanıtları (sefer sonunda otomatik soru)
CREATE TABLE price_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),

    -- Güzergah bilgisi (sefer olmadan da girilebilir)
    from_province VARCHAR(100),
    from_district VARCHAR(100),
    to_province VARCHAR(100),
    to_district VARCHAR(100),

    -- Fiyat
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY',

    -- Yük bilgisi
    cargo_type_id UUID REFERENCES cargo_types(id),
    weight_tons DOUBLE PRECISION,

    -- Meta
    is_verified BOOLEAN DEFAULT false, -- Admin tarafından doğrulandı mı
    notes TEXT,

    -- Zaman
    trip_date DATE, -- Sefer tarihi
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_surveys_driver ON price_surveys(driver_id);
CREATE INDEX idx_price_surveys_route ON price_surveys(from_province, to_province);
CREATE INDEX idx_price_surveys_date ON price_surveys(trip_date DESC);
CREATE INDEX idx_price_surveys_cargo ON price_surveys(cargo_type_id);

-- ============================================
-- Güzergah ve Konum Analizi
-- ============================================

-- Popüler noktalar (otomatik algılanan)
CREATE TABLE hotspots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),

    -- Konum bilgisi
    name VARCHAR(255),
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),

    -- Tip
    spot_type VARCHAR(30) NOT NULL, -- loading, unloading, rest_area, gas_station, parking, industrial, port, customs, terminal

    -- İstatistikler
    visit_count INTEGER DEFAULT 0,
    unique_drivers INTEGER DEFAULT 0,
    avg_duration_minutes INTEGER,

    -- Zaman dağılımı (JSON)
    hourly_distribution JSONB DEFAULT '{}', -- Saatlik dağılım
    daily_distribution JSONB DEFAULT '{}', -- Günlük dağılım

    -- Algılama
    is_verified BOOLEAN DEFAULT false, -- Admin tarafından doğrulandı mı
    is_auto_detected BOOLEAN DEFAULT true,
    cluster_radius_meters INTEGER DEFAULT 100,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hotspots_geom ON hotspots USING GIST(geom);
CREATE INDEX idx_hotspots_province ON hotspots(province);
CREATE INDEX idx_hotspots_type ON hotspots(spot_type);
CREATE INDEX idx_hotspots_visits ON hotspots(visit_count DESC);

-- Hotspot ziyaret logları
CREATE TABLE hotspot_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotspot_id UUID NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    stop_id UUID REFERENCES stops(id),

    arrived_at TIMESTAMP WITH TIME ZONE NOT NULL,
    departed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- Ziyaret sırası (seferdeki kaçıncı durak)
    visit_order INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hotspot_visits_hotspot ON hotspot_visits(hotspot_id);
CREATE INDEX idx_hotspot_visits_driver ON hotspot_visits(driver_id);
CREATE INDEX idx_hotspot_visits_arrived ON hotspot_visits(arrived_at DESC);

-- Rota segmentleri (şehirlerarası güzergahlar)
CREATE TABLE route_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Başlangıç
    from_province VARCHAR(100) NOT NULL,
    from_district VARCHAR(100),
    from_latitude DOUBLE PRECISION,
    from_longitude DOUBLE PRECISION,

    -- Bitiş
    to_province VARCHAR(100) NOT NULL,
    to_district VARCHAR(100),
    to_latitude DOUBLE PRECISION,
    to_longitude DOUBLE PRECISION,

    -- İstatistikler
    trip_count INTEGER DEFAULT 0,
    unique_drivers INTEGER DEFAULT 0,
    avg_distance_km DOUBLE PRECISION,
    avg_duration_minutes INTEGER,

    -- Fiyat istatistikleri
    avg_price DECIMAL(10, 2),
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    price_per_km_avg DECIMAL(8, 2),

    -- Son güncelleme
    last_trip_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_route_segments_from ON route_segments(from_province, from_district);
CREATE INDEX idx_route_segments_to ON route_segments(to_province, to_district);
CREATE INDEX idx_route_segments_count ON route_segments(trip_count DESC);
CREATE UNIQUE INDEX idx_route_segments_unique ON route_segments(from_province, from_district, to_province, to_district);

-- ============================================
-- Pazar Analizi Verileri
-- ============================================

-- Günlük istatistikler (aggregate tablo)
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL,

    -- Şoför istatistikleri
    active_drivers INTEGER DEFAULT 0,
    new_drivers INTEGER DEFAULT 0,
    drivers_on_trip INTEGER DEFAULT 0,

    -- Sefer istatistikleri
    total_trips INTEGER DEFAULT 0,
    completed_trips INTEGER DEFAULT 0,
    total_distance_km DOUBLE PRECISION DEFAULT 0,
    avg_trip_distance_km DOUBLE PRECISION DEFAULT 0,

    -- Fiyat istatistikleri
    avg_price DECIMAL(10, 2),
    avg_price_per_km DECIMAL(8, 2),
    total_revenue DECIMAL(14, 2), -- Toplam taşıma bedeli

    -- Yük istatistikleri
    total_cargo_tons DOUBLE PRECISION DEFAULT 0,

    -- Bölgesel dağılım (JSON)
    province_distribution JSONB DEFAULT '{}',
    cargo_type_distribution JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_daily_stats_date ON daily_stats(stat_date);

-- Saatlik aktivite (trafik analizi için)
CREATE TABLE hourly_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_hour TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Aktivite sayıları
    active_drivers INTEGER DEFAULT 0,
    location_updates INTEGER DEFAULT 0,
    trips_started INTEGER DEFAULT 0,
    trips_ended INTEGER DEFAULT 0,

    -- Bölgesel yoğunluk (JSON)
    province_activity JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_hourly_activity_hour ON hourly_activity(activity_hour);

-- ============================================
-- Trips tablosuna ek alanlar
-- ============================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    cargo_type_id UUID REFERENCES cargo_types(id);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    cargo_type_other VARCHAR(100);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    weight_tons DOUBLE PRECISION;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    price DECIMAL(12, 2);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    price_entered BOOLEAN DEFAULT false;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    from_hotspot_id UUID REFERENCES hotspots(id);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS
    to_hotspot_id UUID REFERENCES hotspots(id);

-- ============================================
-- Stops tablosuna ek alanlar
-- ============================================

ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    hotspot_id UUID REFERENCES hotspots(id);

ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    is_loading BOOLEAN DEFAULT false;

ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    is_unloading BOOLEAN DEFAULT false;

ALTER TABLE stops ADD COLUMN IF NOT EXISTS
    cargo_action VARCHAR(20); -- loading, unloading, both, none

-- ============================================
-- Analiz View'ları
-- ============================================

-- Şehirler arası fiyat matrisi view'ı
CREATE OR REPLACE VIEW route_price_matrix AS
SELECT
    rs.from_province,
    rs.to_province,
    rs.trip_count,
    rs.avg_distance_km,
    rs.avg_price,
    rs.price_per_km_avg,
    CASE
        WHEN rs.trip_count >= 10 THEN 'high_confidence'
        WHEN rs.trip_count >= 5 THEN 'medium_confidence'
        ELSE 'low_confidence'
    END as confidence_level
FROM route_segments rs
WHERE rs.avg_price IS NOT NULL
ORDER BY rs.trip_count DESC;

-- Popüler yükleme/boşaltma noktaları view'ı
CREATE OR REPLACE VIEW popular_terminals AS
SELECT
    h.id,
    h.name,
    h.province,
    h.district,
    h.spot_type,
    h.visit_count,
    h.unique_drivers,
    h.avg_duration_minutes,
    h.latitude,
    h.longitude
FROM hotspots h
WHERE h.spot_type IN ('loading', 'unloading', 'terminal', 'port', 'industrial')
  AND h.visit_count >= 5
ORDER BY h.visit_count DESC;

-- Günlük özet view'ı
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM drivers WHERE is_active = true) as total_active_drivers,
    (SELECT COUNT(*) FROM drivers WHERE current_status = 'driving') as drivers_on_trip,
    (SELECT COUNT(*) FROM trips WHERE started_at >= CURRENT_DATE AND status = 'completed') as today_trips,
    (SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE started_at >= CURRENT_DATE) as today_distance_km,
    (SELECT COALESCE(AVG(price), 0) FROM trip_pricing WHERE recorded_at >= CURRENT_DATE - INTERVAL '7 days') as avg_price_7d,
    (SELECT COUNT(*) FROM hotspots WHERE is_verified = true) as verified_hotspots;

-- ============================================
-- Trigger: Route segment güncelleme
-- ============================================

CREATE OR REPLACE FUNCTION update_route_segment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.start_province IS NOT NULL AND NEW.end_province IS NOT NULL THEN
        INSERT INTO route_segments (from_province, from_district, to_province, to_district,
                                   from_latitude, from_longitude, to_latitude, to_longitude,
                                   trip_count, avg_distance_km, avg_duration_minutes, last_trip_at)
        VALUES (NEW.start_province, NULL, NEW.end_province, NULL,
                NEW.start_latitude, NEW.start_longitude, NEW.end_latitude, NEW.end_longitude,
                1, NEW.distance_km, NEW.duration_minutes, NEW.ended_at)
        ON CONFLICT (from_province, from_district, to_province, to_district)
        DO UPDATE SET
            trip_count = route_segments.trip_count + 1,
            avg_distance_km = (route_segments.avg_distance_km * route_segments.trip_count + NEW.distance_km) / (route_segments.trip_count + 1),
            avg_duration_minutes = (route_segments.avg_duration_minutes * route_segments.trip_count + NEW.duration_minutes) / (route_segments.trip_count + 1),
            last_trip_at = NEW.ended_at,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_route_segment
    AFTER UPDATE ON trips
    FOR EACH ROW
    WHEN (OLD.status = 'ongoing' AND NEW.status = 'completed')
    EXECUTE FUNCTION update_route_segment();

-- ============================================
-- Fonksiyon: Hotspot algılama
-- ============================================

CREATE OR REPLACE FUNCTION detect_hotspots(min_visits INTEGER DEFAULT 5, cluster_radius INTEGER DEFAULT 200)
RETURNS INTEGER AS $$
DECLARE
    detected_count INTEGER := 0;
BEGIN
    -- Sık durılan noktaları hotspot olarak işaretle
    INSERT INTO hotspots (latitude, longitude, geom, province, district, spot_type, visit_count, is_auto_detected)
    SELECT
        AVG(s.latitude) as latitude,
        AVG(s.longitude) as longitude,
        ST_SetSRID(ST_MakePoint(AVG(s.longitude), AVG(s.latitude)), 4326) as geom,
        s.province,
        s.district,
        CASE
            WHEN s.location_type IN ('industrial', 'port') THEN 'loading'
            ELSE COALESCE(s.location_type, 'unknown')
        END as spot_type,
        COUNT(*) as visit_count,
        true as is_auto_detected
    FROM stops s
    WHERE s.duration_minutes >= 15
    GROUP BY
        ROUND(s.latitude::numeric, 3),
        ROUND(s.longitude::numeric, 3),
        s.province,
        s.district,
        s.location_type
    HAVING COUNT(*) >= min_visits
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS detected_count = ROW_COUNT;
    RETURN detected_count;
END;
$$ LANGUAGE plpgsql;
