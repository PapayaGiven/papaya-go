-- Internal videos need a rejection reason so admins can tell creators why a
-- submission was rejected (mirrors go_boost_requests.rejection_reason).
ALTER TABLE go_internal_videos ADD COLUMN IF NOT EXISTS rejection_reason text;
