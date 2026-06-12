-- 004 — Prevent the same TikTok link being submitted twice for one internal
-- creator. Mirrors go_boost_requests_creator_url_unique (see supabase-schema.sql).
-- Idempotent: safe to run more than once.
--
-- NOTE: a UNIQUE constraint cannot be added while duplicate rows already exist,
-- so step 1 removes pre-existing duplicates first (keeping the EARLIEST row per
-- creator + normalized URL). This is destructive for those duplicate rows — review
-- before applying. The app normalizes URLs (trim + lowercase + strip trailing
-- slash) before insert, so the comparison below matches the app's logic.

-- 1. Drop pre-existing duplicates, keeping the earliest submission per pair.
DELETE FROM go_internal_videos a
USING go_internal_videos b
WHERE a.creator_id = b.creator_id
  AND lower(btrim(a.tiktok_url)) = lower(btrim(b.tiktok_url))
  AND (a.submitted_at, a.ctid) > (b.submitted_at, b.ctid);

-- 2. Add the UNIQUE constraint if it isn't already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'go_internal_videos_creator_url_unique'
  ) THEN
    ALTER TABLE go_internal_videos
      ADD CONSTRAINT go_internal_videos_creator_url_unique UNIQUE (creator_id, tiktok_url);
  END IF;
END $$;
