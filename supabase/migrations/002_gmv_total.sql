-- Lifetime cumulative GMV per creator. gmv_this_month resets on the 1st
-- of each month (cron); gmv_total accumulates forever and is never reset.
-- Idempotent — safe to re-run.
ALTER TABLE go_creators ADD COLUMN IF NOT EXISTS gmv_total numeric DEFAULT 0;
