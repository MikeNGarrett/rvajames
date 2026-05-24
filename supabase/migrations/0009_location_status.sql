-- Migration 0009: location_status — operational closure and restriction tracking
-- Part of Round 4 (sub-goal 43).

create type location_status_kind as enum (
  'open',
  'restricted',
  'closed',
  'closed_indefinite'
);

create type location_status_state as enum (
  'draft',
  'active',
  'expired'
);

create table location_status (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid not null references locations(id) on delete cascade,
  kind             location_status_kind not null,
  state            location_status_state not null default 'draft',
  -- null means the whole location is affected; non-null scopes to a specific feature
  affects          text,
  reason           text not null,
  -- human-readable source attribution, e.g. "rva.gov parks page (2026-05-22)"
  source           text not null,
  source_url       text,
  effective_from   timestamptz not null default now(),
  -- null = open-ended (indefinite closure)
  effective_to     timestamptz,
  -- when a human should re-verify this status (esp. for scrape-sourced rows)
  next_review_at   timestamptz,
  created_by       text not null default 'admin',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Optimised for the hot query: active closures for a location on a given date.
create index location_status_active_idx
  on location_status (location_id, state, effective_from desc)
  where state = 'active';

-- Updated_at trigger
create or replace function update_location_status_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger location_status_updated_at
  before update on location_status
  for each row execute function update_location_status_updated_at();

-- Row Level Security
alter table location_status enable row level security;

-- Anon users can read active rows only
create policy "anon_read_active"
  on location_status
  for select
  to anon
  using (state = 'active');

-- Service role bypasses RLS for admin writes (create/update/delete)
-- No explicit policy needed — service role ignores RLS by default in Supabase.
