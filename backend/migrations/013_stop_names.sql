-- Nakliyeo Mobil - Stop Names
-- Duraklara isim verme özelliği
-- IDEMPOTENT: Bu migration birden fazla kez çalıştırılabilir

-- ============================================
-- Stops tablosuna name alanı ekle
-- ============================================

ALTER TABLE stops ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Index for stop names search
CREATE INDEX IF NOT EXISTS idx_stops_name ON stops(name) WHERE name IS NOT NULL;

-- ============================================
-- View güncelle - named stops
-- ============================================

CREATE OR REPLACE VIEW named_stops_summary AS
SELECT
    s.id,
    s.name,
    s.location_type,
    s.province,
    s.district,
    s.latitude,
    s.longitude,
    COUNT(*) OVER (PARTITION BY ROUND(s.latitude::numeric, 3), ROUND(s.longitude::numeric, 3)) as nearby_stops_count,
    COUNT(DISTINCT s.driver_id) OVER (PARTITION BY ROUND(s.latitude::numeric, 3), ROUND(s.longitude::numeric, 3)) as unique_drivers
FROM stops s
WHERE s.name IS NOT NULL
ORDER BY s.name;
