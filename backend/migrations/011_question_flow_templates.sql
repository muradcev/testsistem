-- Migration 011: Question Flow Templates
-- Date: 2025-12-17
-- Description: Soru Akis Tasarimcisi icin sablon tablolari

-- Question Flow Templates tablosu
CREATE TABLE IF NOT EXISTS question_flow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- ReactFlow nodes ve edges JSON olarak saklanir
    flow_nodes JSONB NOT NULL DEFAULT '[]',
    flow_edges JSONB NOT NULL DEFAULT '[]',

    -- Kategori ve etiketler
    category VARCHAR(100), -- yuk_durumu, musaitlik, fiyat, genel
    tags JSONB DEFAULT '[]', -- JSON array of tags

    -- Kullanim istatistikleri
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Durum
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true, -- Diger adminler gorebilir mi?

    -- Meta
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE question_flow_templates IS 'Soru Akis Tasarimcisi sablonlari - ReactFlow ile olusturulan soru akislari';
COMMENT ON COLUMN question_flow_templates.flow_nodes IS 'ReactFlow Node dizisi - her soru bir node';
COMMENT ON COLUMN question_flow_templates.flow_edges IS 'ReactFlow Edge dizisi - sorular arasi baglantilar';
COMMENT ON COLUMN question_flow_templates.category IS 'Sablon kategorisi: yuk_durumu, musaitlik, fiyat, genel vb.';
COMMENT ON COLUMN question_flow_templates.usage_count IS 'Bu sablonun kac kez kullanildigi';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_question_flow_templates_active ON question_flow_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_question_flow_templates_category ON question_flow_templates(category);
CREATE INDEX IF NOT EXISTS idx_question_flow_templates_created_by ON question_flow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_question_flow_templates_created_at ON question_flow_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_flow_templates_usage ON question_flow_templates(usage_count DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_question_flow_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_question_flow_templates_updated_at ON question_flow_templates;
CREATE TRIGGER trigger_question_flow_templates_updated_at
    BEFORE UPDATE ON question_flow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_question_flow_templates_updated_at();

-- Ornek sablonlar
INSERT INTO question_flow_templates (name, description, category, flow_nodes, flow_edges, is_active, is_public) VALUES
(
    'Yuk Durumu Sorgusu',
    'Soforun yuk durumunu ve gidecegi ili sorgular',
    'yuk_durumu',
    '[
        {"id": "start", "type": "question", "position": {"x": 250, "y": 50}, "data": {"questionText": "Su an yukunuz var mi?", "questionType": "yes_no", "isStart": true}},
        {"id": "q2", "type": "question", "position": {"x": 100, "y": 200}, "data": {"questionText": "Yukunuz hangi ile gidecek?", "questionType": "province"}},
        {"id": "q3", "type": "question", "position": {"x": 400, "y": 200}, "data": {"questionText": "Ne zaman musait olursunuz?", "questionType": "text"}}
    ]'::jsonb,
    '[
        {"id": "e1", "source": "start", "target": "q2", "sourceHandle": "yes", "label": "Evet"},
        {"id": "e2", "source": "start", "target": "q3", "sourceHandle": "no", "label": "Hayir"}
    ]'::jsonb,
    true,
    true
),
(
    'Musaitlik Kontrolu',
    'Soforun musait olup olmadigini ve nerede oldugunu sorgular',
    'musaitlik',
    '[
        {"id": "start", "type": "question", "position": {"x": 250, "y": 50}, "data": {"questionText": "Su an musait misiniz?", "questionType": "yes_no", "isStart": true}},
        {"id": "q2", "type": "question", "position": {"x": 100, "y": 200}, "data": {"questionText": "Su an hangi ildesiniz?", "questionType": "province"}},
        {"id": "q3", "type": "question", "position": {"x": 400, "y": 200}, "data": {"questionText": "Ne zaman musait olursunuz?", "questionType": "text"}}
    ]'::jsonb,
    '[
        {"id": "e1", "source": "start", "target": "q2", "sourceHandle": "yes", "label": "Evet"},
        {"id": "e2", "source": "start", "target": "q3", "sourceHandle": "no", "label": "Hayir"}
    ]'::jsonb,
    true,
    true
),
(
    'Fiyat Bilgisi',
    'Son seferden fiyat ve guzergah bilgisi alir',
    'fiyat',
    '[
        {"id": "start", "type": "question", "position": {"x": 250, "y": 50}, "data": {"questionText": "Son seferinizi tamamladiniz mi?", "questionType": "yes_no", "isStart": true}},
        {"id": "q2", "type": "question", "position": {"x": 100, "y": 200}, "data": {"questionText": "Son seferiniz icin ne kadar ucret aldiniz?", "questionType": "price"}},
        {"id": "q3", "type": "question", "position": {"x": 100, "y": 350}, "data": {"questionText": "Nereden nereye gittiniz?", "questionType": "text"}}
    ]'::jsonb,
    '[
        {"id": "e1", "source": "start", "target": "q2", "sourceHandle": "yes", "label": "Evet"},
        {"id": "e2", "source": "q2", "target": "q3"}
    ]'::jsonb,
    true,
    true
);
