-- Migration 008: Add phone_in_use column to locations table
-- This tracks when the driver picks up their phone while driving

-- Add phone_in_use column with default false
ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone_in_use BOOLEAN DEFAULT FALSE;

-- Create index for phone_in_use queries (finding when drivers used phone)
CREATE INDEX IF NOT EXISTS idx_locations_phone_in_use ON locations(driver_id, recorded_at) WHERE phone_in_use = true;

-- Comment
COMMENT ON COLUMN locations.phone_in_use IS 'True when driver picked up phone while driving';
