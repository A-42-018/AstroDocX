-- AstroDocX optional ground server (Supabase / PostgREST).
-- Run in the Supabase SQL editor, then build the console with:
--   VITE_SUPABASE_URL=https://<project>.supabase.co
--   VITE_SUPABASE_ANON_KEY=<anon key>
--
-- SECURITY NOTE (read before using): the anon key ships inside the web app, so these policies let
-- anyone who has the app insert and read rows. That is acceptable only for the hackathon demo with
-- synthetic data. Real crew health data needs signed-in users (Supabase Auth), policies scoped to
-- auth.uid() and a mission/role table, and no anonymous read.

create table if not exists public.action_log (
  uid        text primary key,            -- "<device>:<local id>", makes re-sends idempotent
  device     text        not null,
  crew_id    text        not null,
  kind       text        not null check (kind in ('alert-opened','step-done','alert-resolved','checkin','note')),
  text       text        not null,
  alert_id   integer,
  ts         bigint      not null,        -- mission time, epoch ms
  synced_at  bigint      not null,        -- when the crew console uploaded it, epoch ms
  received   timestamptz not null default now()
);

create index if not exists action_log_crew_ts on public.action_log (crew_id, ts);

alter table public.action_log enable row level security;

-- Demo-grade policies (see the note above). Upsert needs insert + update.
create policy "demo insert" on public.action_log for insert to anon with check (true);
create policy "demo update" on public.action_log for update to anon using (true) with check (true);
create policy "demo read"   on public.action_log for select to anon using (true);
-- No delete policy: the ground log is append-only from the app.
