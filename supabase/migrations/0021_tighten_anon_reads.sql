-- 0021_tighten_anon_reads.sql
-- SEC-5 (security audit 2026-06-09): drop anon SELECT on operational tables.
--
-- ai_interpretations, metro_summaries, and ingestion_runs had anon_read
-- policies with USING (true): anyone holding the public anon key could dump
-- all cached AI text plus per-row cost_usd / token counts (which directly aid
-- tuning the SEC-3 cost attacks) and the full scrape-run history including
-- error strings.
--
-- Every app read of these tables is server-side. get-or-generate and the
-- ingest pipeline always used the service client; /status used the anon
-- client and was switched to the service client for these two tables in the
-- same commit (app/status/page.tsx). No browser-side anon read exists.
--
-- RLS stays ENABLED on all three tables (project hard constraint). With no
-- anon policy, anon SELECT returns zero rows. service_role and agent_reader
-- both carry BYPASSRLS (verified in prod 2026-06-10), so server-side reads
-- and `pnpm query:prod` verification are unaffected.

drop policy if exists "anon_read" on public.ai_interpretations;
drop policy if exists "anon_read" on public.ingestion_runs;
drop policy if exists "anon can read metro_summaries" on public.metro_summaries;
