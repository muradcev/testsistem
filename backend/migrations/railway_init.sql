-- Nakliyeo Mobil - Railway PostgreSQL Init
-- Tum tablolari tek seferde olusturur

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(200),
    home_latitude DOUBLE PRECISION,
    home_longitude DOUBLE PRECISION,
    fcm_token TEXT,
    is_active BOOLEAN DEFAULT true,
    is_phone_verified BOOLEAN DEFAULT false,
    last_location_at TIMESTAMP WITH TIME ZONE,
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    current_status VARCHAR(20) DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_province ON drivers(province);
CREATE INDEX IF NOT EXISTS idx_drivers_current_status ON drivers(current_status);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    plate VARCHAR(20) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    tonnage DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);

-- Trailers table
CREATE TABLE IF NOT EXISTS trailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    plate VARCHAR(20) NOT NULL,
    trailer_type VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trailers_driver_id ON trailers(driver_id);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    is_moving BOOLEAN DEFAULT false,
    activity_type VARCHAR(20) DEFAULT 'unknown',
    battery_level INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_driver_id ON locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_locations_recorded_at ON locations(recorded_at DESC);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id),
    start_latitude DOUBLE PRECISION NOT NULL,
    start_longitude DOUBLE PRECISION NOT NULL,
    start_address TEXT,
    start_province VARCHAR(100),
    end_latitude DOUBLE PRECISION,
    end_longitude DOUBLE PRECISION,
    end_address TEXT,
    end_province VARCHAR(100),
    distance_km DOUBLE PRECISION DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'ongoing',
    cargo_type_id UUID,
    cargo_type_other VARCHAR(100),
    weight_tons DOUBLE PRECISION,
    price DECIMAL(12, 2),
    price_entered BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_started_at ON trips(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- Stops table
CREATE TABLE IF NOT EXISTS stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_type VARCHAR(30) DEFAULT 'unknown',
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    is_in_vehicle BOOLEAN DEFAULT false,
    is_loading BOOLEAN DEFAULT false,
    is_unloading BOOLEAN DEFAULT false,
    cargo_action VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stops_driver_id ON stops(driver_id);
CREATE INDEX IF NOT EXISTS idx_stops_trip_id ON stops(trip_id);

-- ============================================
-- CONFIG TABLES
-- ============================================

-- Cargo types
CREATE TABLE IF NOT EXISTS cargo_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicle brands
CREATE TABLE IF NOT EXISTS vehicle_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicle models
CREATE TABLE IF NOT EXISTS vehicle_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES vehicle_brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trailer types
CREATE TABLE IF NOT EXISTS trailer_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SURVEY TABLES
-- ============================================

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(30) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    options JSONB,
    is_required BOOLEAN DEFAULT true,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PRICING TABLES
-- ============================================

-- Trip cargo
CREATE TABLE IF NOT EXISTS trip_cargo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    cargo_type_id UUID REFERENCES cargo_types(id),
    cargo_type_other VARCHAR(100),
    weight_tons DOUBLE PRECISION,
    is_full_load BOOLEAN DEFAULT true,
    load_percentage INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip pricing
CREATE TABLE IF NOT EXISTS trip_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    total_price DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'TRY',
    price_per_km DECIMAL(8, 2),
    price_type VARCHAR(20) DEFAULT 'fixed',
    fuel_cost DECIMAL(10, 2),
    toll_cost DECIMAL(10, 2),
    other_costs DECIMAL(10, 2),
    paid_by VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'pending',
    source VARCHAR(20) DEFAULT 'driver_input',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

-- Price surveys
CREATE TABLE IF NOT EXISTS price_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    from_province VARCHAR(100),
    from_district VARCHAR(100),
    to_province VARCHAR(100),
    to_district VARCHAR(100),
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY',
    cargo_type_id UUID REFERENCES cargo_types(id),
    weight_tons DOUBLE PRECISION,
    is_verified BOOLEAN DEFAULT false,
    notes TEXT,
    trip_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ADMIN TABLES
-- ============================================

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(30) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ANALYTICS TABLES
-- ============================================

-- Route segments
CREATE TABLE IF NOT EXISTS route_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_province VARCHAR(100) NOT NULL,
    from_district VARCHAR(100),
    to_province VARCHAR(100) NOT NULL,
    to_district VARCHAR(100),
    from_latitude DOUBLE PRECISION,
    from_longitude DOUBLE PRECISION,
    to_latitude DOUBLE PRECISION,
    to_longitude DOUBLE PRECISION,
    trip_count INTEGER DEFAULT 0,
    unique_drivers INTEGER DEFAULT 0,
    avg_distance_km DOUBLE PRECISION,
    avg_duration_minutes INTEGER,
    avg_price DECIMAL(10, 2),
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    price_per_km_avg DECIMAL(8, 2),
    last_trip_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_segments_unique
ON route_segments(from_province, COALESCE(from_district, ''), to_province, COALESCE(to_district, ''));

-- Daily stats
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL UNIQUE,
    active_drivers INTEGER DEFAULT 0,
    new_drivers INTEGER DEFAULT 0,
    drivers_on_trip INTEGER DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    completed_trips INTEGER DEFAULT 0,
    total_distance_km DOUBLE PRECISION DEFAULT 0,
    avg_trip_distance_km DOUBLE PRECISION DEFAULT 0,
    avg_price DECIMAL(10, 2),
    avg_price_per_km DECIMAL(8, 2),
    total_revenue DECIMAL(14, 2),
    total_cargo_tons DOUBLE PRECISION DEFAULT 0,
    province_distribution JSONB DEFAULT '{}',
    cargo_type_distribution JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Default cargo types
INSERT INTO cargo_types (name, description, icon, sort_order) VALUES
    ('Gida', 'Gida ve icecek urunleri', 'food', 1),
    ('Insaat Malzemesi', 'Cimento, demir, kum, cakil vb.', 'construction', 2),
    ('Tarim Urunleri', 'Tahil, meyve, sebze vb.', 'agriculture', 3),
    ('Tekstil', 'Kumas, hazir giyim vb.', 'textile', 4),
    ('Mobilya', 'Ev ve ofis mobilyalari', 'furniture', 5),
    ('Elektronik', 'Beyaz esya, elektronik cihazlar', 'electronics', 6),
    ('Otomotiv', 'Arac parcalari, yedek parca', 'automotive', 7),
    ('Kimyasal', 'Kimyasal maddeler, boya vb.', 'chemical', 8),
    ('Soguk Zincir', 'Sogutma gerektiren urunler', 'cold_chain', 9),
    ('Tehlikeli Madde', 'ADR belgeli tasima gerektiren', 'hazardous', 10),
    ('Konteyner', 'Konteyner tasimaciligi', 'container', 11),
    ('Canli Hayvan', 'Canli hayvan nakliyesi', 'livestock', 12),
    ('Diger', 'Diger yuk tipleri', 'other', 99)
ON CONFLICT DO NOTHING;

-- Default vehicle brands
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
    ('Diger', 99)
ON CONFLICT DO NOTHING;

-- Default trailer types
INSERT INTO trailer_types (name, description, sort_order) VALUES
    ('Tenteli', 'Standart tenteli dorse', 1),
    ('Kapali Kasa', 'Kapali kasa dorse', 2),
    ('Acik Kasa', 'Acik kasa dorse', 3),
    ('Frigo', 'Sogutmali dorse', 4),
    ('Lowbed', 'Alcak platform dorse', 5),
    ('Konteyner', 'Konteyner tasima dorsesi', 6),
    ('Tanker', 'Sivi/gaz tankeri', 7),
    ('Damper', 'Damperli dorse', 8),
    ('Diger', 'Diger dorse tipleri', 99)
ON CONFLICT DO NOTHING;

-- Default settings
INSERT INTO settings (key, value, description) VALUES
    ('sms_verification_enabled', 'false', 'SMS dogrulama aktif mi'),
    ('location_interval_moving', '30', 'Hareket halindeyken konum alma araligi (saniye)'),
    ('location_interval_stopped', '300', 'Duruyorken konum alma araligi (saniye)'),
    ('location_interval_home', '1800', 'Evdeyken konum alma araligi (saniye)'),
    ('stop_detection_threshold', '300', 'Durak algilama icin bekleme suresi (saniye)'),
    ('home_radius_meters', '200', 'Ev yaricapi (metre)')
ON CONFLICT (key) DO NOTHING;

-- Default admin user (password: admin123)
INSERT INTO admin_users (email, password_hash, name, role) VALUES
    ('admin@nakliyeo.com', '$2a$10$8cZ3qxpZpdRGjWS3QJNPteD4UMgEVCMF178zX3UK1y/0UF/Qx/.9q', 'Admin', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Success message
SELECT 'Database initialized successfully!' as status;
