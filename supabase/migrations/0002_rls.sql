-- Enable RLS on all tables. Anon may only SELECT.
-- Cron routes use the service role key, which bypasses RLS for writes.

ALTER TABLE public.locations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conditions_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interpretations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.locations
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read" ON public.activities
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read" ON public.location_activities
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read" ON public.conditions_snapshots
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read" ON public.advisories
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read" ON public.ai_interpretations
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read" ON public.ingestion_runs
  FOR SELECT TO anon USING (true);
