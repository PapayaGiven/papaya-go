-- Key/value settings table for admin-configurable knobs that don't
-- belong on go_creators or another domain table. First use is the
-- weekly-report Google Sheet ID (key = 'weekly_report_sheet_id').
--
-- service_role-only access. The values can include secrets (sheet
-- IDs are not secret per se, but other future settings might be), so
-- we never expose this table to the anon role.
--
-- Idempotent — safe to re-run.

create table if not exists go_settings (
  key text primary key,
  value text,
  updated_at timestamp default now()
);

alter table go_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'go_settings'
      and policyname = 'go_settings_service'
  ) then
    create policy "go_settings_service"
      on go_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
