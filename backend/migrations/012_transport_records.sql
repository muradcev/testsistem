-- Transport Records (Taşıma Kayıtları) tablosu
CREATE TABLE IF NOT EXISTS transport_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Araç bilgileri
    plate VARCHAR(20),                    -- Plaka
    trailer_type VARCHAR(50),             -- Dorse tipi (tenteli, frigo, tanker, etc.)

    -- Güzergah bilgileri
    origin_province VARCHAR(50),          -- Yükleme ili
    origin_district VARCHAR(100),         -- Yükleme ilçesi (opsiyonel)
    destination_province VARCHAR(50),     -- Teslim ili
    destination_district VARCHAR(100),    -- Teslim ilçesi (opsiyonel)

    -- Tarih ve fiyat
    transport_date DATE,                  -- Taşıma tarihi
    price DECIMAL(12, 2),                 -- Taşıma ücreti (TL)
    currency VARCHAR(3) DEFAULT 'TRY',    -- Para birimi

    -- Ek bilgiler
    cargo_type VARCHAR(100),              -- Yük tipi
    cargo_weight DECIMAL(10, 2),          -- Yük ağırlığı (ton)
    distance_km INTEGER,                  -- Mesafe (km)
    notes TEXT,                           -- Notlar

    -- Kaynak bilgisi
    source_type VARCHAR(50) DEFAULT 'manual',  -- manual, question, api
    source_id UUID,                       -- Kaynak ID (örn: question_id)

    -- Zaman damgaları
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_transport_records_driver_id ON transport_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_records_transport_date ON transport_records(transport_date DESC);
CREATE INDEX IF NOT EXISTS idx_transport_records_origin ON transport_records(origin_province);
CREATE INDEX IF NOT EXISTS idx_transport_records_destination ON transport_records(destination_province);
CREATE INDEX IF NOT EXISTS idx_transport_records_price ON transport_records(price);
CREATE INDEX IF NOT EXISTS idx_transport_records_created_at ON transport_records(created_at DESC);

-- Dorse tipleri referans tablosu
CREATE TABLE IF NOT EXISTS trailer_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Varsayılan dorse tipleri
INSERT INTO trailer_types (name, description) VALUES
    ('Tenteli', 'Tenteli dorse'),
    ('Frigo', 'Soğutmalı dorse'),
    ('Tanker', 'Sıvı taşıma tankeri'),
    ('Açık', 'Açık kasa dorse'),
    ('Lowbed', 'Alçak taban dorse'),
    ('Konteyner', 'Konteyner taşıyıcı'),
    ('Silobas', 'Toz/granül taşıma'),
    ('Damperli', 'Damperli dorse'),
    ('Platform', 'Platform dorse'),
    ('Jumbo', 'Jumbo tenteli')
ON CONFLICT (name) DO NOTHING;
