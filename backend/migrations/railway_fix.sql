-- Railway Database Fix Script
-- Eksik tablolari ve admin kullaniciyi olusturur
-- IDEMPOTENT: Birden fazla kez calistiriabilir

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 0. Hotspots Tablosu (PostGIS'siz versiyon)
-- ============================================

CREATE TABLE IF NOT EXISTS hotspots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    name VARCHAR(255),
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    spot_type VARCHAR(30) NOT NULL DEFAULT 'unknown',
    visit_count INTEGER DEFAULT 0,
    unique_drivers INTEGER DEFAULT 0,
    avg_duration_minutes INTEGER,
    hourly_distribution JSONB DEFAULT '{}',
    daily_distribution JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    is_auto_detected BOOLEAN DEFAULT true,
    cluster_radius_meters INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotspots_province ON hotspots(province);
CREATE INDEX IF NOT EXISTS idx_hotspots_type ON hotspots(spot_type);
CREATE INDEX IF NOT EXISTS idx_hotspots_visits ON hotspots(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_location ON hotspots(latitude, longitude);

-- ============================================
-- 1. Audit Logs Tablosu (yeni)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_type VARCHAR(20) NOT NULL,
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_type ON audit_logs(user_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- 2. Admin Users Tablosu (kontrol)
-- ============================================

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

-- Default admin user (password: admin123)
-- Hash: $2a$10$8cZ3qxpZpdRGjWS3QJNPteD4UMgEVCMF178zX3UK1y/0UF/Qx/.9q
INSERT INTO admin_users (email, password_hash, name, role) VALUES
    ('admin@testsistem.com', '$2a$10$8cZ3qxpZpdRGjWS3QJNPteD4UMgEVCMF178zX3UK1y/0UF/Qx/.9q', 'Admin', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 3. Performans Indeksleri
-- ============================================

-- Locations tablosu
CREATE INDEX IF NOT EXISTS idx_locations_driver_recorded ON locations(driver_id, recorded_at DESC);

-- Drivers tablosu
CREATE INDEX IF NOT EXISTS idx_drivers_is_active_true ON drivers(is_active) WHERE is_active = true;

-- Trips tablosu
CREATE INDEX IF NOT EXISTS idx_trips_driver_status ON trips(driver_id, status);

-- Stops tablosu
CREATE INDEX IF NOT EXISTS idx_stops_started_at ON stops(started_at DESC);

-- ============================================
-- 4. Driver Questions (eger yoksa)
-- ============================================

-- Question Source Types
CREATE TABLE IF NOT EXISTS question_source_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO question_source_types (id, name, description) VALUES
    ('manual', 'Manuel', 'Admin tarafindan manuel olusturuldu'),
    ('auto_trip_end', 'Sefer Sonu Otomatik', 'Sefer bitisinde otomatik soruldu'),
    ('auto_stop', 'Durak Otomatik', 'Durak sonrasi otomatik soruldu'),
    ('scheduled', 'Zamanli', 'Zamanlayici ile gonderildi'),
    ('ai_generated', 'AI Uretimi', 'Sistem tarafindan AI ile uretildi'),
    ('rule_based', 'Kural Bazli', 'Belirli kurallara gore otomatik olusturuldu'),
    ('template', 'Sablondan', 'Sablondan turetildi')
ON CONFLICT (id) DO NOTHING;

-- Driver Questions
CREATE TABLE IF NOT EXISTS driver_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    options JSONB,
    follow_up_questions JSONB,
    context_type VARCHAR(50),
    context_data JSONB,
    related_trip_id UUID REFERENCES trips(id),
    source VARCHAR(30) REFERENCES question_source_types(id),
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    is_auto_approved BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_questions_driver ON driver_questions(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_questions_status ON driver_questions(status);
CREATE INDEX IF NOT EXISTS idx_driver_questions_driver_status ON driver_questions(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_questions_scheduled ON driver_questions(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Driver Question Answers
CREATE TABLE IF NOT EXISTS driver_question_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES driver_questions(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    answer_data JSONB,
    follow_up_answers JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_answers_question ON driver_question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_driver ON driver_question_answers(driver_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_answered ON driver_question_answers(answered_at DESC);

-- ============================================
-- 5. Question Rules
-- ============================================

CREATE TABLE IF NOT EXISTS question_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_condition VARCHAR(50) NOT NULL,
    condition_config JSONB DEFAULT '{}',
    question_template TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    options_template JSONB,
    follow_up_template JSONB,
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true,
    auto_approve_confidence DECIMAL(3,2) DEFAULT 0.8,
    priority INTEGER DEFAULT 0,
    cooldown_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_rules_active ON question_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_question_rules_trigger ON question_rules(trigger_condition);

-- ============================================
-- 6. Driver Homes (sofor ev adresleri)
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

CREATE INDEX IF NOT EXISTS idx_driver_homes_driver ON driver_homes(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_homes_active ON driver_homes(driver_id, is_active);

-- ============================================
-- 7. Survey ve Notification Templates
-- ============================================

CREATE TABLE IF NOT EXISTS survey_trigger_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO survey_trigger_types (id, name, description) VALUES
    ('trip_end', 'Sefer Bitisi', 'Sefer tamamlandiginda otomatik gonderilir'),
    ('trip_start', 'Sefer Baslangici', 'Sefer basladiginda gonderilir'),
    ('stop_long', 'Uzun Durak', 'Belirli sureden uzun duruldugunda'),
    ('manual', 'Manuel', 'Admin tarafindan manuel gonderilir'),
    ('weekly', 'Haftalik', 'Her hafta belirli gunde'),
    ('monthly', 'Aylik', 'Her ay belirli gunde')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS survey_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(30) REFERENCES survey_trigger_types(id),
    trigger_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_required BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    icon VARCHAR(50),
    color VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_template_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES survey_templates(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    options JSONB,
    is_required BOOLEAN DEFAULT true,
    order_num INTEGER DEFAULT 0,
    show_condition JSONB,
    validation JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(30),
    trigger_config JSONB DEFAULT '{}',
    target_audience VARCHAR(30) DEFAULT 'all',
    target_provinces TEXT[],
    scheduled_at TIMESTAMP WITH TIME ZONE,
    repeat_type VARCHAR(20),
    repeat_config JSONB,
    is_active BOOLEAN DEFAULT true,
    sent_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. Settings (varsayilan degerler)
-- ============================================

INSERT INTO settings (key, value, description) VALUES
    ('sms_verification_enabled', 'false', 'SMS dogrulama aktif mi'),
    ('location_interval_moving', '30', 'Hareket halindeyken konum alma araligi (saniye)'),
    ('location_interval_stopped', '300', 'Duruyorken konum alma araligi (saniye)'),
    ('location_interval_home', '1800', 'Evdeyken konum alma araligi (saniye)'),
    ('stop_detection_threshold', '300', 'Durak algilama icin bekleme suresi (saniye)'),
    ('home_radius_meters', '200', 'Ev yaricapi (metre)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Sonuc
-- ============================================

SELECT 'Railway database fix completed successfully!' as status;
SELECT 'Admin login: admin@testsistem.com / admin123' as info;
