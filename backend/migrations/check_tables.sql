-- Railway Database Table Check
-- Hangi tabloların mevcut oldugunu kontrol eder

-- Tum tablolari listele
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Kritik tablolari kontrol et
SELECT
    'drivers' as table_name,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drivers') as exists
UNION ALL
SELECT 'admin_users', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_users')
UNION ALL
SELECT 'locations', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'locations')
UNION ALL
SELECT 'trips', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trips')
UNION ALL
SELECT 'stops', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stops')
UNION ALL
SELECT 'vehicles', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vehicles')
UNION ALL
SELECT 'trailers', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trailers')
UNION ALL
SELECT 'hotspots', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hotspots')
UNION ALL
SELECT 'driver_homes', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'driver_homes')
UNION ALL
SELECT 'driver_questions', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'driver_questions')
UNION ALL
SELECT 'driver_question_answers', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'driver_question_answers')
UNION ALL
SELECT 'question_rules', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'question_rules')
UNION ALL
SELECT 'audit_logs', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')
UNION ALL
SELECT 'survey_templates', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'survey_templates')
UNION ALL
SELECT 'notification_templates', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_templates')
UNION ALL
SELECT 'settings', EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'settings');

-- Admin kullanicilari kontrol et
SELECT id, email, name, role, is_active, created_at FROM admin_users;
