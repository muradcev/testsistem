-- Nakliyeo Mobil - Driver Feature Flags
-- Sürücü bazlı özellik açma/kapama

-- Sürücü özellik flag'leri
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS contacts_enabled BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS call_log_enabled BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS surveys_enabled BOOLEAN DEFAULT true;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS questions_enabled BOOLEAN DEFAULT true;

-- Sürücü arama geçmişi tablosu
CREATE TABLE IF NOT EXISTS driver_call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Arama bilgileri
    phone_number VARCHAR(20) NOT NULL,
    contact_name VARCHAR(200),
    call_type VARCHAR(20) NOT NULL, -- incoming, outgoing, missed, rejected
    duration_seconds INTEGER DEFAULT 0,
    call_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

    -- İlişkili kayıtlar
    delivery_id UUID,

    -- Senkronizasyon bilgisi
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_driver_call_logs_driver ON driver_call_logs(driver_id);
CREATE INDEX idx_driver_call_logs_phone ON driver_call_logs(phone_number);
CREATE INDEX idx_driver_call_logs_timestamp ON driver_call_logs(call_timestamp DESC);
CREATE INDEX idx_driver_call_logs_type ON driver_call_logs(call_type);

-- Sürücü rehber tablosu (senkronize edilmiş kişiler)
CREATE TABLE IF NOT EXISTS driver_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Kişi bilgileri
    contact_id VARCHAR(100), -- Telefondaki orijinal ID
    name VARCHAR(200) NOT NULL,
    phone_numbers JSONB DEFAULT '[]', -- ["5551234567", "5559876543"]

    -- Kategori
    contact_type VARCHAR(30), -- customer, broker, colleague, family, unknown

    -- Senkronizasyon
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(driver_id, contact_id)
);

CREATE INDEX idx_driver_contacts_driver ON driver_contacts(driver_id);
CREATE INDEX idx_driver_contacts_name ON driver_contacts(name);

-- Arama istatistikleri view'ı
CREATE OR REPLACE VIEW driver_call_stats AS
SELECT
    d.id as driver_id,
    d.name,
    d.surname,
    d.phone,
    COUNT(DISTINCT cl.id) as total_calls,
    COUNT(DISTINCT CASE WHEN cl.call_type = 'outgoing' THEN cl.id END) as outgoing_calls,
    COUNT(DISTINCT CASE WHEN cl.call_type = 'incoming' THEN cl.id END) as incoming_calls,
    COUNT(DISTINCT CASE WHEN cl.call_type = 'missed' THEN cl.id END) as missed_calls,
    COALESCE(SUM(cl.duration_seconds), 0) as total_duration_seconds,
    COUNT(DISTINCT cl.phone_number) as unique_contacts,
    MAX(cl.call_timestamp) as last_call_at
FROM drivers d
LEFT JOIN driver_call_logs cl ON d.id = cl.driver_id
WHERE d.is_active = true
GROUP BY d.id, d.name, d.surname, d.phone;

-- Sürücü rehber istatistikleri view'ı
CREATE OR REPLACE VIEW driver_contact_stats AS
SELECT
    d.id as driver_id,
    d.name,
    d.surname,
    COUNT(DISTINCT dc.id) as total_contacts,
    COUNT(DISTINCT CASE WHEN dc.contact_type = 'customer' THEN dc.id END) as customer_contacts,
    COUNT(DISTINCT CASE WHEN dc.contact_type = 'broker' THEN dc.id END) as broker_contacts,
    MAX(dc.synced_at) as last_sync_at
FROM drivers d
LEFT JOIN driver_contacts dc ON d.id = dc.driver_id AND dc.is_deleted = false
WHERE d.is_active = true
GROUP BY d.id, d.name, d.surname;
