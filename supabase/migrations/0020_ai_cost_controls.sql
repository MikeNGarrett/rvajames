-- 0020_ai_cost_controls.sql
-- SEC-3 (security audit 2026-06-09): single-flight lock table + daily spend RPC.
--
-- (a) ai_generation_locks: before calling Anthropic on a cache miss, the
--     worker INSERTs the prompt_hash here. The PRIMARY KEY makes that a race
--     with exactly one winner — N concurrent misses for the same key collapse
--     to 1 API call. Losers poll the cache table for the winner's row.
--     Rows are short-lived: the winner deletes its claim after persisting,
--     and any claim older than the in-code TTL (30s) is cleared by the next
--     requester, so a crashed winner can't wedge a key.
--
-- (c) daily_ai_spend_usd: server-side SUM of cost_usd across both AI tables
--     since day_start, for the daily circuit breaker. A SQL function so the
--     sum can't be silently truncated by PostgREST row limits.

create table public.ai_generation_locks (
  prompt_hash text primary key,
  claimed_at  timestamptz not null default now()
);

-- RLS stays enabled on every table (project hard constraint). No policies on
-- purpose: only the service-role client (RLS-exempt) takes and releases locks;
-- anon gets nothing.
alter table public.ai_generation_locks enable row level security;

create or replace function public.daily_ai_spend_usd(day_start timestamptz)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select sum(cost_usd) from public.ai_interpretations where created_at >= day_start), 0)
       + coalesce((select sum(cost_usd) from public.metro_summaries    where created_at >= day_start), 0);
$$;

-- Spend totals aid cost-attack tuning (see SEC-5) — service-role only.
revoke execute on function public.daily_ai_spend_usd(timestamptz) from public, anon, authenticated;
grant execute on function public.daily_ai_spend_usd(timestamptz) to service_role;

-- agent_reader read parity (matches the 0013 pattern: explicit grant, no
-- inheritance from future grants).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'agent_reader') then
    grant select on public.ai_generation_locks to agent_reader;
  end if;
end $$;
