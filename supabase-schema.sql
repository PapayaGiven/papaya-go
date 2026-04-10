-- ═══════════════════════════════════════════════════════════════════════
-- PAPAYA GO — Supabase Schema
-- Run this in the Supabase SQL editor for cgimvsmnfmpzpkakiguo.supabase.co
-- ═══════════════════════════════════════════════════════════════════════

-- 1. go_creators
CREATE TABLE IF NOT EXISTS go_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  tiktok_handle text,
  nivel int DEFAULT 1,
  gmv_total numeric DEFAULT 0,
  gmv_this_month numeric DEFAULT 0,
  acc_this_month int DEFAULT 0,
  ttd_this_month int DEFAULT 0,
  videos_this_month int DEFAULT 0,
  status text DEFAULT 'pending',
  access_code text,
  approved_at timestamp,
  created_at timestamp DEFAULT now()
);

ALTER TABLE go_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_creators_read_own" ON go_creators FOR SELECT USING (email = auth.email());
CREATE POLICY "go_creators_service" ON go_creators FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. go_pois
CREATE TABLE IF NOT EXISTS go_pois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  commission text,
  perk text,
  min_nivel int DEFAULT 1,
  capcut_template_url text,
  image_emoji text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

ALTER TABLE go_pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_pois_read_all" ON go_pois FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_pois_service" ON go_pois FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. go_capcut_templates
CREATE TABLE IF NOT EXISTS go_capcut_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text NOT NULL,
  min_nivel int DEFAULT 1,
  video_type text DEFAULT 'general',
  created_at timestamp DEFAULT now()
);

ALTER TABLE go_capcut_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_capcut_read_all" ON go_capcut_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_capcut_service" ON go_capcut_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. go_nivel_requirements
CREATE TABLE IF NOT EXISTS go_nivel_requirements (
  nivel int PRIMARY KEY,
  name text NOT NULL,
  acc_required int DEFAULT 0,
  ttd_required int DEFAULT 0,
  total_videos_required int DEFAULT 0,
  gmv_required numeric DEFAULT 0,
  perks text,
  resources_unlocked text
);

ALTER TABLE go_nivel_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_nivel_read_all" ON go_nivel_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_nivel_service" ON go_nivel_requirements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed nivel requirements
INSERT INTO go_nivel_requirements (nivel, name, acc_required, ttd_required, total_videos_required, gmv_required, perks, resources_unlocked)
VALUES
  (1, 'Explorer',     3, 1, 12, 0,    'Contenido propio',                    'Templates básicos'),
  (2, 'Contributor',  3, 2, 20, 500,  'Day passes',                          'Templates avanzados, POIs nivel 2'),
  (3, 'Partner',      3, 2, 30, 2000, '1 noche de estadía',                  'Portfolio pitching, POIs nivel 3'),
  (4, 'Elite',        5, 3, 60, 5000, 'Multi-night stays, mentor role',       'Todos los recursos, mentoría')
ON CONFLICT (nivel) DO UPDATE SET
  name = excluded.name,
  acc_required = excluded.acc_required,
  ttd_required = excluded.ttd_required,
  total_videos_required = excluded.total_videos_required,
  gmv_required = excluded.gmv_required,
  perks = excluded.perks,
  resources_unlocked = excluded.resources_unlocked;

-- 5. go_portfolio_submissions
CREATE TABLE IF NOT EXISTS go_portfolio_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES go_creators(id) ON DELETE CASCADE,
  media_kit_url text,
  stats_screenshot_url text,
  video_links text[],
  status text DEFAULT 'pending',
  notes text,
  created_at timestamp DEFAULT now()
);

ALTER TABLE go_portfolio_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_portfolio_read_own" ON go_portfolio_submissions FOR SELECT USING (
  creator_id IN (SELECT id FROM go_creators WHERE email = auth.email())
);
CREATE POLICY "go_portfolio_insert_own" ON go_portfolio_submissions FOR INSERT WITH CHECK (
  creator_id IN (SELECT id FROM go_creators WHERE email = auth.email())
);
CREATE POLICY "go_portfolio_service" ON go_portfolio_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. go_announcements
CREATE TABLE IF NOT EXISTS go_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

ALTER TABLE go_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_announcements_read_all" ON go_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_announcements_service" ON go_announcements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. go_viral_videos
CREATE TABLE IF NOT EXISTS go_viral_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_url text NOT NULL UNIQUE,
  tiktok_handle text,
  views text,
  video_type text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

ALTER TABLE go_viral_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_viral_read_all" ON go_viral_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_viral_service" ON go_viral_videos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. go_poi_requests
CREATE TABLE IF NOT EXISTS go_poi_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES go_creators(id),
  creator_name text,
  tiktok_handle text,
  place_name text NOT NULL,
  city_state text,
  place_type text,
  reason text,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
ALTER TABLE go_poi_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_poi_requests_insert" ON go_poi_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "go_poi_requests_read_own" ON go_poi_requests FOR SELECT USING (creator_id IN (SELECT id FROM go_creators WHERE email = auth.email()));
CREATE POLICY "go_poi_requests_service" ON go_poi_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. go_nivel_rewards
CREATE TABLE IF NOT EXISTS go_nivel_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel int NOT NULL,
  reward_name text NOT NULL,
  reward_description text,
  reward_emoji text DEFAULT '🎁',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
ALTER TABLE go_nivel_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_nivel_rewards_read" ON go_nivel_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_nivel_rewards_service" ON go_nivel_rewards FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default rewards
INSERT INTO go_nivel_rewards (nivel, reward_name, reward_description, reward_emoji) VALUES
(1, 'PR Box de Viaje', 'Caja sorpresa con productos de viaje seleccionados por Papaya', '📦'),
(1, 'Shoutout en Instagram', 'Te presentamos en el Instagram de Papaya GO', '📸'),
(2, 'Day Pass en Hotel', 'Acceso de un día a las instalaciones de un hotel partner', '🏊'),
(2, 'Sesión de Coaching 1:1', '30 minutos con un coach de Papaya GO', '🎯'),
(3, '1 Noche Gratis', 'Una noche en un hotel partner de Papaya GO', '🏨'),
(3, 'Feature en Comunidad', 'Tu perfil destacado en todos los canales de Papaya GO', '⭐'),
(4, 'Multi-night Stay', 'Varias noches en propiedades premium', '🌟'),
(4, 'Gift Personalizado', 'Regalo personalizado por ser Top Creator', '🎀'),
(4, 'Rol de Mentora', 'Conviértete en mentora oficial de Papaya GO', '👑');

-- 10. go_reward_requests
CREATE TABLE IF NOT EXISTS go_reward_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES go_creators(id),
  creator_name text,
  tiktok_handle text,
  nivel int,
  reward_id uuid REFERENCES go_nivel_rewards(id),
  reward_name text,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
ALTER TABLE go_reward_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_reward_requests_insert" ON go_reward_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "go_reward_requests_read_own" ON go_reward_requests FOR SELECT USING (creator_id IN (SELECT id FROM go_creators WHERE email = auth.email()));
CREATE POLICY "go_reward_requests_service" ON go_reward_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. go_boost_requests
CREATE TABLE IF NOT EXISTS go_boost_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES go_creators(id),
  creator_name text,
  tiktok_handle text,
  tiktok_url text,
  video_url text,
  boost_reason text,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
ALTER TABLE go_boost_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_boost_insert" ON go_boost_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "go_boost_read_own" ON go_boost_requests FOR SELECT USING (creator_id IN (SELECT id FROM go_creators WHERE email = auth.email()));
CREATE POLICY "go_boost_service" ON go_boost_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. go_challenges
CREATE TABLE IF NOT EXISTS go_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  challenge_type text NOT NULL,
  prize text,
  prize_description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
ALTER TABLE go_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "go_challenges_read" ON go_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "go_challenges_service" ON go_challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
