-- Nakliyeo Mobil - Location Telemetry Migration
-- Konum verilerine telemetri alanları ekleme
-- IDEMPOTENT: Bu migration birden fazla kez çalıştırılabilir

-- ============================================
-- 1. Ağ bilgileri
-- ============================================

ALTER TABLE locations ADD COLUMN IF NOT EXISTS connection_type VARCHAR(20);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS wifi_ssid VARCHAR(100);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- ============================================
-- 2. Pil ek bilgileri
-- ============================================

ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_charging BOOLEAN DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS power_save_mode BOOLEAN DEFAULT false;

-- ============================================
-- 3. Sensör verileri (JSONB)
-- ============================================

ALTER TABLE locations ADD COLUMN IF NOT EXISTS accelerometer JSONB;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS gyroscope JSONB;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS max_acceleration_g DOUBLE PRECISION;

-- ============================================
-- 4. Meta veriler
-- ============================================

ALTER TABLE locations ADD COLUMN IF NOT EXISTS speed_kmh DOUBLE PRECISION;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS trigger VARCHAR(50);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS interval_seconds INTEGER;

-- ============================================
-- 5. Performans indexleri
-- ============================================

CREATE INDEX IF NOT EXISTS idx_locations_connection_type ON locations(connection_type);
CREATE INDEX IF NOT EXISTS idx_locations_is_charging ON locations(is_charging);
CREATE INDEX IF NOT EXISTS idx_locations_trigger ON locations(trigger);

-- ============================================
-- 6. Yorum
-- ============================================

COMMENT ON COLUMN locations.connection_type IS 'Bağlantı tipi: wifi, mobile, none';
COMMENT ON COLUMN locations.wifi_ssid IS 'Bağlı WiFi ağ adı';
COMMENT ON COLUMN locations.ip_address IS 'Cihaz IP adresi';
COMMENT ON COLUMN locations.is_charging IS 'Şarj oluyor mu';
COMMENT ON COLUMN locations.power_save_mode IS 'Güç tasarrufu modu aktif mi';
COMMENT ON COLUMN locations.accelerometer IS 'İvmeölçer verisi {x, y, z}';
COMMENT ON COLUMN locations.gyroscope IS 'Jiroskop verisi {x, y, z}';
COMMENT ON COLUMN locations.max_acceleration_g IS 'Son ölçümden bu yana maksimum ivme (G)';
COMMENT ON COLUMN locations.speed_kmh IS 'Hız km/h cinsinden';
COMMENT ON COLUMN locations.trigger IS 'Konum kaynağı: foreground_service, workmanager, immediate';
COMMENT ON COLUMN locations.interval_seconds IS 'Konum aralığı (saniye)';

-- ============================================
-- 7. Success message
-- ============================================

SELECT 'Location telemetry columns added!' as status;
