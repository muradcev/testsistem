-- Migration 009: Permission fields for mobile device permissions
-- Date: 2025-12-17
-- Description: Add permission tracking fields to drivers table

-- Add contacts_permission field
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS contacts_permission VARCHAR(50);
COMMENT ON COLUMN drivers.contacts_permission IS 'Mobil cihazdaki rehber izni durumu: granted, denied, permanently_denied, restricted, limited';

-- Add phone_permission field (for call log access)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone_permission VARCHAR(50);
COMMENT ON COLUMN drivers.phone_permission IS 'Mobil cihazdaki telefon/arama izni durumu: granted, denied, permanently_denied';

-- Add notification_permission field
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notification_permission VARCHAR(50);
COMMENT ON COLUMN drivers.notification_permission IS 'Mobil cihazdaki bildirim izni durumu: granted, denied, permanently_denied';

-- Create index for filtering by permissions
CREATE INDEX IF NOT EXISTS idx_drivers_contacts_permission ON drivers(contacts_permission);
CREATE INDEX IF NOT EXISTS idx_drivers_phone_permission ON drivers(phone_permission);
CREATE INDEX IF NOT EXISTS idx_drivers_notification_permission ON drivers(notification_permission);
