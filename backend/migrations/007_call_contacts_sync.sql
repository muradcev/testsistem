-- Nakliyeo Mobil - Call Logs & Contacts Sync Migration
-- IDEMPOTENT: Bu migration birden fazla kez calistirabilir

-- ============================================
-- 1. driver_call_logs tablosu (yoksa olustur)
-- ============================================

CREATE TABLE IF NOT EXISTS driver_call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    phone_number VARCHAR(30) NOT NULL,
    contact_name VARCHAR(255),
    call_type VARCHAR(20) NOT NULL, -- incoming, outgoing, missed, rejected
    duration_seconds INTEGER DEFAULT 0,
    call_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_id UUID,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for upsert (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_unique
ON driver_call_logs(driver_id, phone_number, call_timestamp);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_driver ON driver_call_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON driver_call_logs(call_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_type ON driver_call_logs(call_type);

-- ============================================
-- 2. driver_contacts tablosu (yoksa olustur)
-- ============================================

CREATE TABLE IF NOT EXISTS driver_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    contact_id VARCHAR(255), -- Device contact ID
    name VARCHAR(255) NOT NULL,
    phone_numbers JSONB DEFAULT '[]',
    contact_type VARCHAR(30), -- customer, broker, colleague, family
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for upsert (prevents duplicates by contact_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique
ON driver_contacts(driver_id, contact_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_driver ON driver_contacts(driver_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON driver_contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON driver_contacts(contact_type);

-- ============================================
-- 3. Success message
-- ============================================

SELECT 'Call logs and contacts sync tables ready!' as status;
