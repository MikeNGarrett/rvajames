-- Sub-goal 26: metro_summaries table for lazy AI metro-level river summaries.
-- Keyed by (date, age_bucket, prompt_hash) — no location_id.
-- Same dedup pattern as ai_interpretations: UNIQUE constraint handles concurrent writes.

create table public.metro_summaries (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  age_bucket   age_bucket not null,
  model        text not null,
  prompt_hash  text not null,
  body_md      text not null,
  headline     text not null default '',
  top_concerns jsonb not null default '[]',
  best_bets    jsonb not null default '[]',
  tokens_in    integer not null default 0,
  tokens_out   integer not null default 0,
  cost_usd     numeric(10, 6) not null default 0,
  created_at   timestamptz not null default now(),
  unique (date, age_bucket, prompt_hash)
);

create index on public.metro_summaries (date, age_bucket);
create index on public.metro_summaries (created_at desc);

-- RLS: read-only for anon, full access for service role
alter table public.metro_summaries enable row level security;

create policy "anon can read metro_summaries"
  on public.metro_summaries
  for select
  to anon
  using (true);

create policy "service role full access metro_summaries"
  on public.metro_summaries
  for all
  to service_role
  using (true)
  with check (true);
