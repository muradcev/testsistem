-- Nakliyeo Mobil - Initial Database Schema
-- PostgreSQL with PostGIS and TimescaleDB

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(200) NOT NULL,
    home_latitude DOUBLE PRECISION,
    home_longitude DOUBLE PRECISION,
    fcm_token TEXT,
    is_active BOOLEAN DEFAULT true,
    is_phone_verified BOOLEAN DEFAULT false,
    last_location_at TIMESTAMP WITH TIME ZONE,
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    current_status VARCHAR(20) DEFAULT 'unknown', -- home, driving, stopped, unknown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drivers_phone ON drivers(phone);
CREATE INDEX idx_drivers_province ON drivers(province);
CREATE INDEX idx_drivers_current_status ON drivers(current_status);
CREATE INDEX idx_drivers_last_location_at ON drivers(last_location_at);

-- Vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    plate VARCHAR(20) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL, -- kamyon, tir, kamyonet
    tonnage DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_plate ON vehicles(plate);

-- Trailers table
CREATE TABLE trailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    plate VARCHAR(20) NOT NULL,
    trailer_type VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trailers_driver_id ON trailers(driver_id);

-- Locations table (will be converted to hypertable if TimescaleDB is available)
CREATE TABLE locations (
    id BIGSERIAL,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    is_moving BOOLEAN DEFAULT false,
    activity_type VARCHAR(20) DEFAULT 'unknown', -- driving, still, walking, unknown
    battery_level INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
);

CREATE INDEX idx_locations_driver_id ON locations(driver_id);
CREATE INDEX idx_locations_recorded_at ON locations(recorded_at DESC);
CREATE INDEX idx_locations_driver_recorded ON locations(driver_id, recorded_at DESC);

-- Try to create hypertable (will fail silently if TimescaleDB not installed)
DO $$
BEGIN
    PERFORM create_hypertable('locations', 'recorded_at', if_not_exists => TRUE);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available, using regular table';
END $$;

-- Trips table
CREATE TABLE trips (
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
    status VARCHAR(20) DEFAULT 'ongoing', -- ongoing, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_started_at ON trips(started_at DESC);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_provinces ON trips(start_province, end_province);

-- Stops table
CREATE TABLE stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_type VARCHAR(30) DEFAULT 'unknown', -- home, rest_area, industrial, gas_station, port, customs, parking, mall, unknown
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    is_in_vehicle BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stops_driver_id ON stops(driver_id);
CREATE INDEX idx_stops_trip_id ON stops(trip_id);
CREATE INDEX idx_stops_started_at ON stops(started_at DESC);
CREATE INDEX idx_stops_location_type ON stops(location_type);

-- Surveys table
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(30) NOT NULL, -- manual, location, time, trip_end, stop_start
    trigger_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_surveys_is_active ON surveys(is_active);
CREATE INDEX idx_surveys_trigger_type ON surveys(trigger_type);

-- Survey questions table
CREATE TABLE survey_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL, -- yes_no, multiple_choice, number, text
    options JSONB,
    is_required BOOLEAN DEFAULT true,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_survey_questions_survey_id ON survey_questions(survey_id);

-- Survey responses table
CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_survey_responses_driver_id ON survey_responses(driver_id);
CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_answered_at ON survey_responses(answered_at DESC);

-- Admin users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(30) DEFAULT 'admin', -- super_admin, admin, viewer
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Settings table
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
    ('sms_verification_enabled', 'false', 'SMS doğrulama aktif mi'),
    ('location_interval_moving', '30', 'Hareket halindeyken konum alma aralığı (saniye)'),
    ('location_interval_stopped', '300', 'Duruyorken konum alma aralığı (saniye)'),
    ('location_interval_home', '1800', 'Evdeyken konum alma aralığı (saniye)'),
    ('stop_detection_threshold', '300', 'Durak algılama için bekleme süresi (saniye)'),
    ('home_radius_meters', '200', 'Ev yarıçapı (metre)'),
    ('netgsm_usercode', '', 'Netgsm kullanıcı kodu'),
    ('netgsm_password', '', 'Netgsm şifre'),
    ('netgsm_msgheader', '', 'Netgsm mesaj başlığı');

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (email, password_hash, name, role) VALUES
    ('admin@nakliyeo.com', '$2a$10$8cZ3qxpZpdRGjWS3QJNPteD4UMgEVCMF178zX3UK1y/0UF/Qx/.9q', 'Admin', 'super_admin');
