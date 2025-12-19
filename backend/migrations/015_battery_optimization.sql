-- 015_battery_optimization.sql
-- Pil optimizasyonu devre dışı durumunu takip etmek için

-- Add battery_optimization_disabled field
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS battery_optimization_disabled BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN drivers.battery_optimization_disabled IS 'Android pil optimizasyonu devre dışı mı (konum takibi için gerekli)';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_drivers_battery_optimization ON drivers(battery_optimization_disabled);
