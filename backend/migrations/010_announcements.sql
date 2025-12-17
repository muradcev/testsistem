-- Migration 010: Announcements - Dinamik anasayfa içerikleri
-- Date: 2025-12-17
-- Description: Admin panelinden mobil anasayfaya içerik eklemek için tablo

-- Announcements tablosu
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    link_url VARCHAR(500),
    link_text VARCHAR(100),
    type VARCHAR(50) NOT NULL DEFAULT 'info', -- info, warning, success, promotion
    priority INT NOT NULL DEFAULT 0, -- Siralama onceligi (yuksek = once)
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_dismissable BOOLEAN NOT NULL DEFAULT true, -- Kullanici kapatabilir mi?
    start_at TIMESTAMP WITH TIME ZONE, -- Ne zaman gosterilmeye baslasin
    end_at TIMESTAMP WITH TIME ZONE, -- Ne zaman gosterilmeyi bitirsin
    target_type VARCHAR(50) NOT NULL DEFAULT 'all', -- all, province, specific_drivers
    target_data JSONB, -- province listesi veya driver ID listesi
    created_by UUID NOT NULL REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE announcements IS 'Admin panelinden mobil uygulamaya gonderilen duyurular/icerikler';
COMMENT ON COLUMN announcements.type IS 'Duyuru tipi: info, warning, success, promotion';
COMMENT ON COLUMN announcements.priority IS 'Siralama onceligi - yuksek deger once gosterilir';
COMMENT ON COLUMN announcements.is_dismissable IS 'Kullanici bu duyuruyu kapatabilir mi?';
COMMENT ON COLUMN announcements.target_type IS 'Hedef kitle: all=herkes, province=belirli iller, specific_drivers=belirli soforler';
COMMENT ON COLUMN announcements.target_data IS 'Hedef veri: province icin ["Istanbul","Ankara"], specific_drivers icin UUID listesi';

-- Dismissed announcements tablosu (kullanici hangi duyurulari kapatti)
CREATE TABLE IF NOT EXISTS announcement_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(announcement_id, driver_id)
);

COMMENT ON TABLE announcement_dismissals IS 'Soforlerin kapattigi duyurular';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_target_type ON announcements(target_type);
CREATE INDEX IF NOT EXISTS idx_announcements_date_range ON announcements(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_driver ON announcement_dismissals(driver_id);
CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_announcement ON announcement_dismissals(announcement_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_announcements_updated_at ON announcements;
CREATE TRIGGER trigger_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();
