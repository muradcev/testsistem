-- Nakliyeo Mobil - FK Referans Düzeltmeleri
-- driver_questions.approved_by FK referansını admin_users'a düzelt
-- IDEMPOTENT: Bu migration birden fazla kez çalıştırılabilir

-- ============================================
-- 1. Eski FK constraint'i kaldır (varsa)
-- ============================================

DO $$
BEGIN
    -- driver_questions tablosunda approved_by için FK varsa kaldır
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'driver_questions_approved_by_fkey'
        AND table_name = 'driver_questions'
    ) THEN
        ALTER TABLE driver_questions DROP CONSTRAINT driver_questions_approved_by_fkey;
    END IF;
END $$;

-- ============================================
-- 2. Doğru FK constraint ekle
-- ============================================

DO $$
BEGIN
    -- admin_users tablosu varsa ve FK yoksa ekle
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'driver_questions_approved_by_admin_users_fkey'
            AND table_name = 'driver_questions'
        ) THEN
            ALTER TABLE driver_questions
            ADD CONSTRAINT driver_questions_approved_by_admin_users_fkey
            FOREIGN KEY (approved_by) REFERENCES admin_users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- ============================================
-- 3. Yorum ekle
-- ============================================

COMMENT ON COLUMN driver_questions.approved_by IS 'Onaylayan admin kullanıcı ID (admin_users.id)';

-- ============================================
-- 4. Success message
-- ============================================

SELECT 'FK reference fixed: driver_questions.approved_by -> admin_users(id)' as status;
