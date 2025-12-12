-- Nakliyeo Mobil - Templates and Extended Analytics
-- Anket şablonları, bildirim şablonları, ısı haritası ve zaman analizi

-- ============================================
-- Anket Şablonları
-- ============================================

-- Anket tetikleyici tipleri
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
    -- Tetikleyici ayarları örnek:
    -- location_enter/exit: { "hotspot_ids": [], "provinces": [], "radius_meters": 500 }
    -- stop_long: { "min_duration_minutes": 30 }
    -- time_scheduled: { "hour": 18, "days": [1,2,3,4,5] }
    -- weekly: { "day_of_week": 5, "hour": 18 }

    is_active BOOLEAN DEFAULT true,
    is_required BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,

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
    options JSONB,
    is_required BOOLEAN DEFAULT true,
    order_num INTEGER DEFAULT 0,
    show_condition JSONB, -- { "question_id": "...", "answer": "yes" }
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

    trigger_type VARCHAR(30), -- manual, scheduled, event
    trigger_config JSONB DEFAULT '{}',

    target_audience VARCHAR(30) DEFAULT 'all', -- all, active, inactive, on_trip, at_home, new
    target_provinces TEXT[],

    scheduled_at TIMESTAMP WITH TIME ZONE,
    repeat_type VARCHAR(20), -- once, daily, weekly, monthly
    repeat_config JSONB,

    is_active BOOLEAN DEFAULT true,

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

    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, read, failed
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
    ('Yakıt Fiyatı Güncelleme', 'Yakıt Fiyatları Güncellendi', 'Motorin fiyatı: {{diesel_price}} TL/Lt', 'announcement', 'manual', 'all'),
    ('Anket Hatırlatma', 'Görüşleriniz Önemli', 'Henüz yanıtlanmamış bir anketiniz var. Lütfen birkaç dakikanızı ayırın.', 'reminder', 'scheduled', 'active');

-- ============================================
-- Isı Haritası ve Zaman Analizi
-- ============================================

-- Lokasyon yoğunluk grid (ısı haritası için)
CREATE TABLE location_density_grid (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grid_lat DECIMAL(7, 4) NOT NULL, -- 0.01 derece hassasiyet (~1km)
    grid_lng DECIMAL(7, 4) NOT NULL,

    -- İstatistikler
    location_count INTEGER DEFAULT 0,
    unique_drivers INTEGER DEFAULT 0,
    avg_speed DOUBLE PRECISION,
    stop_count INTEGER DEFAULT 0,
    avg_stop_duration INTEGER, -- dakika

    -- Zaman dağılımı
    hour_distribution JSONB DEFAULT '{}', -- { "0": 10, "1": 5, ... "23": 15 }
    day_distribution JSONB DEFAULT '{}', -- { "mon": 100, "tue": 120, ... }

    province VARCHAR(100),
    district VARCHAR(100),

    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(grid_lat, grid_lng)
);

CREATE INDEX idx_density_grid_location ON location_density_grid(grid_lat, grid_lng);
CREATE INDEX idx_density_grid_province ON location_density_grid(province);
CREATE INDEX idx_density_grid_count ON location_density_grid(location_count DESC);

-- Saatlik aktivite log
CREATE TABLE hourly_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hour_start TIMESTAMP WITH TIME ZONE NOT NULL,

    active_drivers INTEGER DEFAULT 0,
    moving_drivers INTEGER DEFAULT 0,
    stationary_drivers INTEGER DEFAULT 0,

    location_updates INTEGER DEFAULT 0,
    trips_started INTEGER DEFAULT 0,
    trips_ended INTEGER DEFAULT 0,
    stops_started INTEGER DEFAULT 0,

    avg_speed DOUBLE PRECISION,
    total_distance_km DOUBLE PRECISION DEFAULT 0,

    -- Bölgesel dağılım (top 10 il)
    province_distribution JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(hour_start)
);

CREATE INDEX idx_hourly_activity_hour ON hourly_activity_log(hour_start DESC);

-- Trafik akış verileri (şehirler arası)
CREATE TABLE traffic_flow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL, -- 0-23

    from_province VARCHAR(100) NOT NULL,
    to_province VARCHAR(100) NOT NULL,

    trip_count INTEGER DEFAULT 0,
    unique_drivers INTEGER DEFAULT 0,
    avg_duration_minutes INTEGER,

    UNIQUE(date, hour, from_province, to_province)
);

CREATE INDEX idx_traffic_flow_date ON traffic_flow(date DESC);
CREATE INDEX idx_traffic_flow_provinces ON traffic_flow(from_province, to_province);
CREATE INDEX idx_traffic_flow_hour ON traffic_flow(hour);

-- ============================================
-- Analiz Fonksiyonları
-- ============================================

-- Isı haritası grid güncelleme
CREATE OR REPLACE FUNCTION update_density_grid()
RETURNS void AS $$
BEGIN
    INSERT INTO location_density_grid (grid_lat, grid_lng, location_count, unique_drivers, province)
    SELECT
        ROUND(latitude::numeric, 2) as grid_lat,
        ROUND(longitude::numeric, 2) as grid_lng,
        COUNT(*) as location_count,
        COUNT(DISTINCT driver_id) as unique_drivers,
        MAX(
            (SELECT province FROM drivers WHERE id = l.driver_id LIMIT 1)
        ) as province
    FROM locations l
    WHERE recorded_at >= NOW() - INTERVAL '24 hours'
    GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
    ON CONFLICT (grid_lat, grid_lng) DO UPDATE SET
        location_count = location_density_grid.location_count + EXCLUDED.location_count,
        unique_drivers = GREATEST(location_density_grid.unique_drivers, EXCLUDED.unique_drivers),
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Saatlik aktivite log oluştur
CREATE OR REPLACE FUNCTION generate_hourly_activity()
RETURNS void AS $$
DECLARE
    hour_ts TIMESTAMP WITH TIME ZONE;
BEGIN
    hour_ts := date_trunc('hour', NOW() - INTERVAL '1 hour');

    INSERT INTO hourly_activity_log (
        hour_start, active_drivers, moving_drivers, location_updates,
        trips_started, trips_ended, avg_speed, total_distance_km
    )
    SELECT
        hour_ts,
        (SELECT COUNT(DISTINCT driver_id) FROM locations WHERE recorded_at >= hour_ts AND recorded_at < hour_ts + INTERVAL '1 hour'),
        (SELECT COUNT(DISTINCT driver_id) FROM locations WHERE recorded_at >= hour_ts AND recorded_at < hour_ts + INTERVAL '1 hour' AND speed > 10),
        (SELECT COUNT(*) FROM locations WHERE recorded_at >= hour_ts AND recorded_at < hour_ts + INTERVAL '1 hour'),
        (SELECT COUNT(*) FROM trips WHERE started_at >= hour_ts AND started_at < hour_ts + INTERVAL '1 hour'),
        (SELECT COUNT(*) FROM trips WHERE ended_at >= hour_ts AND ended_at < hour_ts + INTERVAL '1 hour'),
        (SELECT AVG(speed) FROM locations WHERE recorded_at >= hour_ts AND recorded_at < hour_ts + INTERVAL '1 hour' AND speed > 0),
        (SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE ended_at >= hour_ts AND ended_at < hour_ts + INTERVAL '1 hour')
    ON CONFLICT (hour_start) DO UPDATE SET
        active_drivers = EXCLUDED.active_drivers,
        moving_drivers = EXCLUDED.moving_drivers,
        location_updates = EXCLUDED.location_updates,
        trips_started = EXCLUDED.trips_started,
        trips_ended = EXCLUDED.trips_ended,
        avg_speed = EXCLUDED.avg_speed,
        total_distance_km = EXCLUDED.total_distance_km;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- View'lar
-- ============================================

-- Isı haritası view'ı
CREATE OR REPLACE VIEW heatmap_data AS
SELECT
    grid_lat as lat,
    grid_lng as lng,
    location_count as intensity,
    unique_drivers,
    province
FROM location_density_grid
WHERE location_count >= 10
ORDER BY location_count DESC
LIMIT 1000;

-- Zaman bazlı aktivite view'ı
CREATE OR REPLACE VIEW time_activity_view AS
SELECT
    EXTRACT(HOUR FROM hour_start) as hour,
    AVG(active_drivers) as avg_active_drivers,
    AVG(moving_drivers) as avg_moving_drivers,
    SUM(trips_started) as total_trips_started,
    SUM(trips_ended) as total_trips_ended,
    AVG(avg_speed) as avg_speed
FROM hourly_activity_log
WHERE hour_start >= NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM hour_start)
ORDER BY hour;

-- Günlük trafik akışı view'ı
CREATE OR REPLACE VIEW daily_traffic_flow_view AS
SELECT
    from_province,
    to_province,
    SUM(trip_count) as total_trips,
    COUNT(DISTINCT date) as active_days,
    AVG(avg_duration_minutes) as avg_duration
FROM traffic_flow
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY from_province, to_province
HAVING SUM(trip_count) >= 5
ORDER BY total_trips DESC;

-- ============================================
-- Kullanıcı Bazlı Akıllı Soru Sistemi
-- ============================================

-- Soru durumları için enum
CREATE TABLE question_status_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

INSERT INTO question_status_types (id, name, description) VALUES
    ('draft', 'Taslak', 'Oluşturuldu, henüz onaylanmadı'),
    ('pending_approval', 'Onay Bekliyor', 'Admin onayı bekliyor'),
    ('approved', 'Onaylandı', 'Admin tarafından onaylandı, gönderilebilir'),
    ('sent', 'Gönderildi', 'Kullanıcıya gönderildi'),
    ('answered', 'Cevaplandı', 'Kullanıcı cevapladı'),
    ('expired', 'Süresi Doldu', 'Cevaplama süresi geçti'),
    ('rejected', 'Reddedildi', 'Admin tarafından reddedildi');

-- Soru kaynağı tipleri
CREATE TABLE question_source_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

INSERT INTO question_source_types (id, name, description) VALUES
    ('manual', 'Manuel', 'Admin tarafından manuel oluşturuldu'),
    ('ai_generated', 'AI Üretimi', 'Sistem tarafından AI ile üretildi'),
    ('rule_based', 'Kural Bazlı', 'Belirli kurallara göre otomatik oluşturuldu'),
    ('template', 'Şablondan', 'Şablondan türetildi');

-- Kullanıcıya özel sorular (akıllı soru sistemi)
CREATE TABLE driver_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Soru içeriği
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL, -- yes_no, multiple_choice, text, number, price, route_select
    options JSONB, -- Seçenekler (multiple_choice için)

    -- Takip soruları (koşullu)
    follow_up_questions JSONB DEFAULT '[]',
    -- Örnek: [
    --   { "condition": { "answer": "yes" }, "question": "Nereye?", "type": "text" },
    --   { "condition": { "answer": "no" }, "question": "Yük arıyor musun?", "type": "yes_no" }
    -- ]

    -- Kaynak ve durum
    source_type VARCHAR(30) REFERENCES question_source_types(id) DEFAULT 'manual',
    status VARCHAR(30) REFERENCES question_status_types(id) DEFAULT 'draft',

    -- Bağlam (neden bu soru soruldu)
    context_type VARCHAR(50), -- trip_active, trip_completed, location_based, time_based, history_based
    context_data JSONB DEFAULT '{}',
    -- Örnek context_data:
    -- trip_active: { "trip_id": "..." }
    -- trip_completed: { "trip_id": "...", "from_province": "İzmir", "to_province": "İstanbul" }
    -- history_based: { "last_trip_id": "...", "route": "İzmir-İstanbul", "days_ago": 3 }

    -- İlişkili kayıtlar
    related_trip_id UUID REFERENCES trips(id),
    template_id UUID REFERENCES survey_templates(id),

    -- Öncelik ve zamanlama
    priority INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE, -- Belirli zamanda gönderilecek

    -- Onay bilgileri
    approved_by UUID REFERENCES admins(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- AI üretim bilgileri
    ai_confidence DECIMAL(3, 2), -- 0.00-1.00
    ai_reasoning TEXT, -- AI'ın bu soruyu neden önerdiği

    -- Gönderim bilgileri
    sent_at TIMESTAMP WITH TIME ZONE,
    notification_id UUID REFERENCES notification_history(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_driver_questions_driver ON driver_questions(driver_id);
CREATE INDEX idx_driver_questions_status ON driver_questions(status);
CREATE INDEX idx_driver_questions_source ON driver_questions(source_type);
CREATE INDEX idx_driver_questions_pending ON driver_questions(status) WHERE status = 'pending_approval';
CREATE INDEX idx_driver_questions_scheduled ON driver_questions(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Soru cevapları
CREATE TABLE driver_question_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES driver_questions(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

    -- Ana cevap
    answer_value TEXT NOT NULL,
    answer_type VARCHAR(30) NOT NULL, -- text, number, boolean, json

    -- Takip soru cevapları
    follow_up_answers JSONB DEFAULT '[]',
    -- Örnek: [
    --   { "question": "Nereye?", "answer": "İstanbul" },
    --   { "question": "Kaç TL?", "answer": 15000 }
    -- ]

    -- Meta
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answer_duration_seconds INTEGER, -- Cevaplama süresi

    -- Konum (cevaplandığında)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_question_answers_question ON driver_question_answers(question_id);
CREATE INDEX idx_question_answers_driver ON driver_question_answers(driver_id);
CREATE INDEX idx_question_answers_date ON driver_question_answers(answered_at DESC);

-- Soru kuralları (otomatik soru üretimi için)
CREATE TABLE question_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Tetikleyici koşullar
    trigger_condition VARCHAR(50) NOT NULL, -- driver_on_trip, trip_completed, idle_driver, location_change
    condition_config JSONB DEFAULT '{}',
    -- Örnekler:
    -- driver_on_trip: { "min_duration_minutes": 30 }
    -- trip_completed: { "min_distance_km": 50, "routes": ["İzmir-İstanbul", "Ankara-İzmir"] }
    -- idle_driver: { "idle_minutes": 60, "last_trip_hours_ago": 24 }

    -- Soru şablonu
    question_template TEXT NOT NULL, -- {{from_province}}'dan {{to_province}}'a yük taşıdın mı?
    question_type VARCHAR(30) NOT NULL,
    options_template JSONB,
    follow_up_template JSONB,

    -- Ayarlar
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true, -- Admin onayı gerekli mi?
    auto_approve_confidence DECIMAL(3, 2) DEFAULT 0.90, -- Bu güvenin üstündekiler otomatik onaylansın

    priority INTEGER DEFAULT 0,
    cooldown_hours INTEGER DEFAULT 24, -- Aynı kullanıcıya tekrar sorma süresi

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_question_rules_trigger ON question_rules(trigger_condition);
CREATE INDEX idx_question_rules_active ON question_rules(is_active);

-- Varsayılan soru kuralları
INSERT INTO question_rules (name, description, trigger_condition, condition_config, question_template, question_type, follow_up_template, requires_approval) VALUES
    (
        'Seferdeki Şoföre Yük Sorusu',
        'Aktif seferde olan şoföre yük durumunu sor',
        'driver_on_trip',
        '{"min_duration_minutes": 30}',
        'Şu an yükünüz var mı?',
        'yes_no',
        '[
            {"condition": {"answer": "yes"}, "question": "Yükünüz nereye?", "type": "text"},
            {"condition": {"answer": "no"}, "question": "Yük arıyor musunuz?", "type": "yes_no"}
        ]',
        false
    ),
    (
        'Tamamlanan Sefer Fiyat Sorusu',
        'Sefer tamamlandığında fiyat bilgisi sor',
        'trip_completed',
        '{"min_distance_km": 50}',
        '{{from_province}} - {{to_province}} seferiniz için ne kadar ücret aldınız?',
        'price',
        '[
            {"condition": {"answer_exists": true}, "question": "Yük türü neydi?", "type": "multiple_choice", "options": ["Genel Kargo", "Paletli", "Konteyner", "Dökme", "Soğuk Zincir"]}
        ]',
        false
    ),
    (
        'Geçmiş Sefer Doğrulama',
        'Yakın zamanda yapılan seferleri doğrula',
        'trip_completed',
        '{"days_ago_max": 7, "needs_price_data": true}',
        'Son {{days_ago}} gün içinde {{from_province}} - {{to_province}} arası sefer yaptınız mı?',
        'yes_no',
        '[
            {"condition": {"answer": "yes"}, "question": "Bu sefer için kaç TL aldınız?", "type": "price"},
            {"condition": {"answer": "no"}, "question": "En son hangi güzergahta sefer yaptınız?", "type": "text"}
        ]',
        true
    ),
    (
        'Bekleyen Şoför Sorusu',
        'Uzun süredir hareketsiz şoföre durum sor',
        'idle_driver',
        '{"idle_hours": 4, "last_active_hours_ago": 8}',
        'Şu an müsait misiniz?',
        'yes_no',
        '[
            {"condition": {"answer": "yes"}, "question": "Hangi bölgeden yük almak istersiniz?", "type": "text"},
            {"condition": {"answer": "no"}, "question": "Ne zaman müsait olursunuz?", "type": "text"}
        ]',
        false
    );

-- Soru üretim geçmişi (AI ve kural bazlı)
CREATE TABLE question_generation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    rule_id UUID REFERENCES question_rules(id),
    driver_id UUID REFERENCES drivers(id),
    question_id UUID REFERENCES driver_questions(id),

    generation_type VARCHAR(30) NOT NULL, -- rule_based, ai_generated
    trigger_event VARCHAR(100), -- Ne tetikledi

    -- AI detayları
    ai_model VARCHAR(50),
    ai_prompt TEXT,
    ai_response TEXT,
    ai_tokens_used INTEGER,

    -- Sonuç
    was_approved BOOLEAN,
    was_answered BOOLEAN,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_question_gen_log_rule ON question_generation_log(rule_id);
CREATE INDEX idx_question_gen_log_driver ON question_generation_log(driver_id);
CREATE INDEX idx_question_gen_log_date ON question_generation_log(created_at DESC);

-- ============================================
-- Kullanıcı Bağlam View'ları (Akıllı soru için)
-- ============================================

-- Aktif seferdeki şoförler
CREATE OR REPLACE VIEW drivers_on_trip AS
SELECT
    d.id as driver_id,
    d.name,
    d.surname,
    d.phone,
    t.id as trip_id,
    t.started_at,
    t.start_province,
    t.distance_km,
    EXTRACT(EPOCH FROM (NOW() - t.started_at)) / 60 as trip_duration_minutes,
    l.latitude as current_lat,
    l.longitude as current_lng,
    l.speed as current_speed
FROM drivers d
JOIN trips t ON d.id = t.driver_id AND t.status = 'active'
LEFT JOIN LATERAL (
    SELECT latitude, longitude, speed
    FROM locations
    WHERE driver_id = d.id
    ORDER BY recorded_at DESC
    LIMIT 1
) l ON true
WHERE d.is_active = true;

-- Son seferi tamamlamış şoförler
CREATE OR REPLACE VIEW drivers_trip_completed AS
SELECT
    d.id as driver_id,
    d.name,
    d.surname,
    t.id as trip_id,
    t.start_province as from_province,
    t.end_province as to_province,
    t.distance_km,
    t.ended_at,
    EXTRACT(EPOCH FROM (NOW() - t.ended_at)) / 3600 as hours_since_completion,
    (SELECT COUNT(*) FROM trip_pricing tp WHERE tp.trip_id = t.id) as has_price_data
FROM drivers d
JOIN trips t ON d.id = t.driver_id
WHERE t.status = 'completed'
    AND t.ended_at >= NOW() - INTERVAL '7 days'
    AND d.is_active = true
ORDER BY t.ended_at DESC;

-- Beklemede olan şoförler
CREATE OR REPLACE VIEW idle_drivers AS
SELECT
    d.id as driver_id,
    d.name,
    d.surname,
    d.province as home_province,
    l.latitude as last_lat,
    l.longitude as last_lng,
    l.recorded_at as last_location_time,
    EXTRACT(EPOCH FROM (NOW() - l.recorded_at)) / 3600 as idle_hours,
    (
        SELECT ended_at
        FROM trips
        WHERE driver_id = d.id AND status = 'completed'
        ORDER BY ended_at DESC
        LIMIT 1
    ) as last_trip_ended
FROM drivers d
LEFT JOIN LATERAL (
    SELECT latitude, longitude, recorded_at
    FROM locations
    WHERE driver_id = d.id
    ORDER BY recorded_at DESC
    LIMIT 1
) l ON true
WHERE d.is_active = true
    AND d.status != 'on_trip'
    AND (l.recorded_at IS NULL OR l.recorded_at < NOW() - INTERVAL '2 hours');

-- Admin onay bekleyen sorular
CREATE OR REPLACE VIEW pending_approval_questions AS
SELECT
    dq.*,
    d.name as driver_name,
    d.surname as driver_surname,
    d.phone as driver_phone,
    d.province as driver_province,
    qr.name as rule_name
FROM driver_questions dq
JOIN drivers d ON dq.driver_id = d.id
LEFT JOIN question_rules qr ON dq.context_data->>'rule_id' = qr.id::text
WHERE dq.status = 'pending_approval'
ORDER BY dq.priority DESC, dq.created_at ASC;
