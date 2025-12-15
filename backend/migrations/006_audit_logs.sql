-- Nakliyeo Mobil - Audit Logs Migration
-- IDEMPOTENT: Bu migration birden fazla kez calistirabilir

-- ============================================
-- Audit Logs Tablosu
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_type VARCHAR(20) NOT NULL, -- admin, driver
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- login, logout, create, update, delete, view, approve, reject, send
    resource_type VARCHAR(50) NOT NULL, -- driver, vehicle, trailer, question, survey, trip, admin, settings, notification
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);

-- ============================================
-- Performans Indeksleri (Eksik olanlar)
-- ============================================

-- Locations tablosu
CREATE INDEX IF NOT EXISTS idx_locations_driver_recorded ON locations(driver_id, recorded_at DESC);

-- Drivers tablosu
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active) WHERE is_active = true;

-- Trips tablosu
CREATE INDEX IF NOT EXISTS idx_trips_driver_status ON trips(driver_id, status);

-- Stops tablosu
CREATE INDEX IF NOT EXISTS idx_stops_started_at ON stops(started_at DESC);

-- Driver Questions
CREATE INDEX IF NOT EXISTS idx_driver_questions_driver_status ON driver_questions(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_questions_status ON driver_questions(status);

-- Driver Question Answers
CREATE INDEX IF NOT EXISTS idx_question_answers_driver_id ON driver_question_answers(driver_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_answered_at ON driver_question_answers(answered_at DESC);

-- Success message
SELECT 'Audit logs table and performance indexes created successfully!' as status;
