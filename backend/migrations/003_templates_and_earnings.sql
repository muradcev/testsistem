-- Nakliyeo Mobil - Templates, Earnings and Extended Features
-- Anket şablonları, bildirim şablonları, kazanç takibi

-- ============================================
-- Anket Şablonları
-- ============================================

-- Anket tetikleyici tipleri için enum benzeri tablo
CREATE TABLE survey_trigger_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO survey_trigger_types (id, name, description) VALUES
    ('trip_end', 'Sefer Bitişi', 'Sefer tamamlandığında otomatik gönderilir'),
    ('trip_start', 'Sefer Başlangıcı', 'Sefer başladığında gönderilir'),
    ('stop_long', 'Uzun Durak', 'Belirli süreden uzun durulduğunda'),
    ('location_enter', 'Konuma Giriş', 'Belirli bir konuma girildiğinde'),
    ('location_exit', 'Konumdan Çıkış', 'Belirli bir konumdan çıkıldığında'),
    ('time_scheduled', 'Zamanlı', 'Belirli saat/günde gönderilir'),
    ('manual', 'Manuel', 'Admin tarafından manuel gönderilir'),
    ('first_trip', 'İlk Sefer', 'Şoförün ilk seferinden sonra'),
    ('weekly', 'Haftalık', 'Her hafta belirli günde'),
    ('monthly', 'Aylık', 'Her ay belirli günde');

-- Anket şablonları
CREATE TABLE survey_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(30) REFERENCES survey_trigger_types(id),
    trigger_config JSONB DEFAULT '{}',
    -- Tetikleyici ayarları:
    -- location_enter/exit: { "hotspot_ids": [], "provinces": [], "radius_meters": 500 }
    -- stop_long: { "min_duration_minutes": 30 }
    -- time_scheduled: { "hour": 18, "days": [1,2,3,4,5] }
    -- weekly: { "day_of_week": 5, "hour": 18 }

    is_active BOOLEAN DEFAULT true,
    is_required BOOLEAN DEFAULT false, -- Zorunlu mu?
    priority INTEGER DEFAULT 0, -- Öncelik (yüksek = önce)

    -- Görünüm
    icon VARCHAR(50),
    color VARCHAR(20),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_survey_templates_trigger ON survey_templates(trigger_type);
CREATE INDEX idx_survey_templates_active ON survey_templates(is_active);

-- Şablon soruları
CREATE TABLE survey_template_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES survey_templates(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL, -- yes_no, multiple_choice, scale, number, text, price, rating
    options JSONB, -- Seçenekler
    is_required BOOLEAN DEFAULT true,
    order_num INTEGER DEFAULT 0,

    -- Koşullu gösterim
    show_condition JSONB, -- { "question_id": "...", "answer": "yes" }

    -- Validasyon
    validation JSONB, -- { "min": 0, "max": 100000, "step": 100 }

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_template_questions_template ON survey_template_questions(template_id);

-- Varsayılan anket şablonları
INSERT INTO survey_templates (name, description, trigger_type, is_active, priority) VALUES
    ('Sefer Sonu Fiyat', 'Sefer tamamlandığında fiyat bilgisi sorar', 'trip_end', true, 100),
    ('Haftalık Memnuniyet', 'Haftalık genel memnuniyet anketi', 'weekly', true, 50),
    ('Yükleme Noktası Değerlendirme', 'Yükleme noktasından ayrılırken', 'location_exit', false, 30),
    ('İlk Sefer Hoş Geldin', 'Yeni şoförlerin ilk seferinden sonra', 'first_trip', true, 90);

-- ============================================
-- Bildirim Şablonları
-- ============================================

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,

    -- Şablon değişkenleri: {{driver_name}}, {{trip_distance}}, {{price}}, vb.

    category VARCHAR(50) NOT NULL, -- announcement, alert, reminder, promotion, system

    -- Tetikleyici
    trigger_type VARCHAR(30), -- manual, scheduled, event
    trigger_config JSONB DEFAULT '{}',

    -- Hedef kitle
    target_audience VARCHAR(30) DEFAULT 'all', -- all, active, inactive, on_trip, at_home, new
    target_provinces TEXT[], -- Belirli illerdeki şoförler

    -- Zamanlama
    scheduled_at TIMESTAMP WITH TIME ZONE,
    repeat_type VARCHAR(20), -- once, daily, weekly, monthly
    repeat_config JSONB,

    is_active BOOLEAN DEFAULT true,

    -- İstatistikler
    sent_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);

-- Bildirim geçmişi
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES notification_templates(id),
    driver_id UUID REFERENCES drivers(id),

    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,

    -- Durum
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, read, failed

    -- FCM response
    fcm_message_id VARCHAR(255),
    error_message TEXT,

    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_history_driver ON notification_history(driver_id);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_notification_history_sent ON notification_history(sent_at DESC);

-- Varsayılan bildirim şablonları
INSERT INTO notification_templates (name, title, body, category, trigger_type, target_audience) VALUES
    ('Hoş Geldin', 'Nakliyeo''ya Hoş Geldiniz!', 'Merhaba {{driver_name}}, aramıza hoş geldiniz. İyi seferler dileriz!', 'system', 'event', 'new'),
    ('Haftalık Özet', 'Haftalık Özetiniz', 'Bu hafta {{trip_count}} sefer, {{total_distance}} km yol yaptınız.', 'reminder', 'scheduled', 'active'),
    ('Hava Durumu Uyarısı', 'Dikkat: Olumsuz Hava Koşulları', '{{province}} bölgesinde {{weather_condition}} bekleniyor. Lütfen dikkatli olun.', 'alert', 'manual', 'all'),
    ('Yakıt Fiyatı Güncelleme', 'Yakıt Fiyatları Güncellendi', 'Motorin fiyatı: {{diesel_price}} TL/Lt', 'announcement', 'manual', 'all');

-- ============================================
-- Kazanç ve Gider Takibi
-- ============================================

-- Kazanç kategorileri
CREATE TABLE earning_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- income, expense
    icon VARCHAR(50),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO earning_categories (name, type, icon, sort_order) VALUES
    -- Gelirler
    ('Sefer Ücreti', 'income', 'truck', 1),
    ('Hammaliye', 'income', 'box', 2),
    ('Bekleme Ücreti', 'income', 'clock', 3),
    ('Diğer Gelir', 'income', 'plus', 99),
    -- Giderler
    ('Yakıt', 'expense', 'fuel', 1),
    ('Otoyol/Köprü', 'expense', 'road', 2),
    ('Yemek', 'expense', 'food', 3),
    ('Konaklama', 'expense', 'hotel', 4),
    ('Bakım/Onarım', 'expense', 'wrench', 5),
    ('Sigorta', 'expense', 'shield', 6),
    ('Vergi/Harç', 'expense', 'document', 7),
    ('Telefon/İletişim', 'expense', 'phone', 8),
    ('Park Ücreti', 'expense', 'parking', 9),
    ('Diğer Gider', 'expense', 'minus', 99);

-- Kazanç/Gider kayıtları
CREATE TABLE earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    category_id UUID REFERENCES earning_categories(id),

    type VARCHAR(20) NOT NULL, -- income, expense
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY',

    description TEXT,

    -- Konum (nerede girildi)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    province VARCHAR(100),

    -- Fatura/Makbuz
    receipt_image_url TEXT,

    -- Tarih
    transaction_date DATE NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_earnings_driver ON earnings(driver_id);
CREATE INDEX idx_earnings_trip ON earnings(trip_id);
CREATE INDEX idx_earnings_type ON earnings(type);
CREATE INDEX idx_earnings_date ON earnings(transaction_date DESC);
CREATE INDEX idx_earnings_category ON earnings(category_id);

-- Günlük kazanç özeti (aggregate)
CREATE TABLE daily_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    total_income DECIMAL(12, 2) DEFAULT 0,
    total_expense DECIMAL(12, 2) DEFAULT 0,
    net_earnings DECIMAL(12, 2) DEFAULT 0,

    trip_count INTEGER DEFAULT 0,
    total_distance_km DOUBLE PRECISION DEFAULT 0,

    -- Kategori bazlı dağılım
    income_breakdown JSONB DEFAULT '{}',
    expense_breakdown JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(driver_id, date)
);

CREATE INDEX idx_daily_earnings_driver_date ON daily_earnings(driver_id, date DESC);

-- ============================================
-- Yakıt Takibi
-- ============================================

CREATE TABLE fuel_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id),
    trip_id UUID REFERENCES trips(id),

    -- Yakıt bilgisi
    fuel_type VARCHAR(20) DEFAULT 'diesel', -- diesel, gasoline, lpg
    liters DECIMAL(8, 2) NOT NULL,
    price_per_liter DECIMAL(6, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,

    -- Kilometre
    odometer_km INTEGER,

    -- İstasyon bilgisi
    station_name VARCHAR(100),
    station_brand VARCHAR(50),

    -- Konum
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    province VARCHAR(100),
    district VARCHAR(100),

    -- Fatura
    receipt_image_url TEXT,

    filled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fuel_records_driver ON fuel_records(driver_id);
CREATE INDEX idx_fuel_records_vehicle ON fuel_records(vehicle_id);
CREATE INDEX idx_fuel_records_filled ON fuel_records(filled_at DESC);

-- ============================================
-- Maliyet Hesaplayıcı Parametreleri
-- ============================================

CREATE TABLE cost_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    parameter_key VARCHAR(50) UNIQUE NOT NULL,
    value DECIMAL(12, 4) NOT NULL,
    unit VARCHAR(20), -- TL, TL/km, TL/lt, %, etc.
    description TEXT,

    -- Geçerlilik
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,

    -- Bölgesel fark
    province VARCHAR(100), -- NULL = tüm Türkiye

    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO cost_parameters (name, parameter_key, value, unit, description) VALUES
    ('Motorin Fiyatı', 'diesel_price', 43.50, 'TL/Lt', 'Ortalama motorin fiyatı'),
    ('Km Başına Yakıt', 'fuel_per_km', 0.35, 'Lt/km', 'Ortalama yakıt tüketimi'),
    ('Km Başına Lastik', 'tire_cost_per_km', 0.15, 'TL/km', 'Lastik amortisman maliyeti'),
    ('Km Başına Bakım', 'maintenance_per_km', 0.25, 'TL/km', 'Ortalama bakım maliyeti'),
    ('Günlük Amortisman', 'daily_depreciation', 500, 'TL/gün', 'Araç değer kaybı'),
    ('Şoför Günlük Gider', 'driver_daily_cost', 300, 'TL/gün', 'Yemek, konaklama vb.'),
    ('Otoyol Ortalama', 'highway_toll_avg', 2.5, 'TL/km', 'Ortalama otoyol ücreti');

-- ============================================
-- Zaman Analizi için View'lar
-- ============================================

-- Saatlik aktivite view'ı
CREATE OR REPLACE VIEW hourly_activity_view AS
SELECT
    date_trunc('hour', l.recorded_at) as hour,
    COUNT(DISTINCT l.driver_id) as active_drivers,
    COUNT(*) as location_updates,
    COUNT(DISTINCT CASE WHEN l.speed > 10 THEN l.driver_id END) as moving_drivers,
    AVG(l.speed) as avg_speed
FROM locations l
WHERE l.recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY date_trunc('hour', l.recorded_at)
ORDER BY hour DESC;

-- Haftalık özet view'ı
CREATE OR REPLACE VIEW weekly_summary_view AS
SELECT
    d.id as driver_id,
    d.name || ' ' || d.surname as driver_name,
    COUNT(DISTINCT t.id) as trip_count,
    COALESCE(SUM(t.distance_km), 0) as total_distance,
    COALESCE(SUM(tp.total_price), 0) as total_earnings,
    COALESCE(SUM(e.amount) FILTER (WHERE e.type = 'expense'), 0) as total_expenses
FROM drivers d
LEFT JOIN trips t ON d.id = t.driver_id AND t.started_at >= NOW() - INTERVAL '7 days'
LEFT JOIN trip_pricing tp ON t.id = tp.trip_id
LEFT JOIN earnings e ON d.id = e.driver_id AND e.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
WHERE d.is_active = true
GROUP BY d.id, d.name, d.surname;

-- ============================================
-- Trigger: Günlük kazanç özeti güncelleme
-- ============================================

CREATE OR REPLACE FUNCTION update_daily_earnings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO daily_earnings (driver_id, date, total_income, total_expense, net_earnings)
    SELECT
        NEW.driver_id,
        NEW.transaction_date,
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) -
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
    FROM earnings
    WHERE driver_id = NEW.driver_id AND transaction_date = NEW.transaction_date
    ON CONFLICT (driver_id, date) DO UPDATE SET
        total_income = EXCLUDED.total_income,
        total_expense = EXCLUDED.total_expense,
        net_earnings = EXCLUDED.net_earnings;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_earnings
    AFTER INSERT OR UPDATE ON earnings
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_earnings();
