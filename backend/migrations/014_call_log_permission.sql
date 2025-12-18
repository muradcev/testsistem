-- Nakliyeo Mobil - Call Log Permission
-- Android 9+ için READ_CALL_LOG izni ayrı olarak takip edilir
-- IDEMPOTENT: Bu migration birden fazla kez çalıştırılabilir

-- ============================================
-- Drivers tablosuna call_log_permission alanı ekle
-- ============================================

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS call_log_permission VARCHAR(50);

-- Comment
COMMENT ON COLUMN drivers.call_log_permission IS 'Android 9+ için READ_CALL_LOG izni (granted, denied, permanently_denied)';
