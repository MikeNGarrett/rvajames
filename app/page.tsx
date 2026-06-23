import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { searchParamsCache, isValidAgeBucket, type AgeBucket } from '@/lib/url-state';
import { formatRichmondDate } from '@/lib/utils/date-tz';
import { getTodayData, OutOfWindowError } from '@/lib/queries/today';
import { getMetroRiverState } from '@/lib/queries/river-segment';
import { getForecastWindow, isInWindow } from '@/lib/queries/date-range';
import { buildRedirectUrl } from '@/lib/utils/redirect-to-today';
import { RiverLevelTile } from '@/components/tiles/RiverLevelTile';
import { AdvisoriesBanner } from '@/components/tiles/AdvisoriesBanner';
import { SevereWeatherBanner } from '@/components/banners/SevereWeatherBanner';
import { CsoBanner } from '@/components/banners/CsoBanner';
import { DateUnavailableBanner } from '@/components/banners/DateUnavailableBanner';
import { DisclaimerFooter } from '@/components/legal/DisclaimerFooter';
import { FirstVisitBanner } from '@/components/legal/FirstVisitBanner';
import { ConditionsForm } from '@/components/filters/ConditionsForm';
import { EmptyState } from '@/components/states/Empty';
import { StaleState } from '@/components/states/Stale';
import { RiverSegmentPanel } from '@/components/metro/RiverSegmentPanel';
import { MetroSummaryPanel } from '@/components/metro/MetroSummaryPanel';
import { RichmondConditionsSection } from '@/components/richmond/RichmondConditionsSection';
import { getRichmondConditionsData } from '@/lib/queries/richmond-conditions';
import { PageContainer } from '@/components/ui/PageContainer';
import { isStale } from '@/lib/freshness';
import { severeWeatherStatus } from '@/lib/safety/rules';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const { date, age } = searchParamsCache.parse(params);
  const ageBucket: AgeBucket = isValidAgeBucket(age) ? age : '6-9';
  // date is null when ?date= is absent. The URL param is already a Richmond-time
  // YYYY-MM-DD string (set by the date chips), so use it directly without any
  // Date round-trip. Fall back to formatRichmondDate(new Date()) per-request so
  // the default never goes stale on warm Workers (see lib/url-state.ts).
  const dateStr = date ?? formatRichmondDate(new Date());

  // ── Proactive guard: redirect out-of-window dates before hitting the DB ──
  if (!isInWindow(dateStr)) {
    redirect(buildRedirectUrl('/', params));
  }

  // ── Forecast chips (server-computed, passed to ConditionsForm) ──
  const chips = getForecastWindow();

  // ── Notice banner ──
  const notice = typeof params.notice === 'string' ? params.notice : undefined;

  // Fetch deterministic data in parallel — these render immediately.
  // OutOfWindowError is a belt-and-suspenders catch (proactive guard above
  // should prevent this, but covers edge-cases like clock skew).
  let data: Awaited<ReturnType<typeof getTodayData>>;
  let metroState: Awaited<ReturnType<typeof getMetroRiverState>>;
  try {
    [data, metroState] = await Promise.all([
      getTodayData(dateStr, ageBucket),
      getMetroRiverState(ageBucket),
    ]);
  } catch (err) {
    if (err instanceof OutOfWindowError) {
      redirect(buildRedirectUrl('/', params));
    }
    throw err;
  }

  // Richmond Conditions data (sub-goal 90). Sequential after metroState
  // because the resolver needs upriver water temp + gage; cheap to compute
  // since the heavy lifting is already in metroState.
  const richmondData = data.mode === 'observed'
    ? await getRichmondConditionsData(dateStr, metroState)
    : null;

  // First-visit banner — render in initial HTML only if the user hasn't
  // already dismissed the safety notice. Server-side cookie read avoids
  // the client-mount layout shift the localStorage-only approach caused.
  const cookieStore = await cookies();
  const showFirstVisitBanner = !cookieStore.get('rva-james-safety-acknowledged');

  // Deterministic severe-weather gate (NWS watches/warnings). Drives the
  // top-of-page banner regardless of date mode — like the CSO banner, it's a
  // current real-time hazard. Source of truth even if the lazy AI never loads.
  const severeWeather = severeWeatherStatus(data.activeAdvisories);

  const staleSnapshotAge = data.locations[0]?.snapshotAge ?? null;
  const showStaleWarning = staleSnapshotAge !== null && isStale('usgs', staleSnapshotAge);

  // ── Forecast CSO advisory copy — age-bucket-aware action line ────────────────
  const forecastCsoAction =
    ageBucket === '0-2' || ageBucket === '3-5'
      ? 'Avoid all water contact with your kids until the advisory clears.'
      : ageBucket === '14+'
      ? 'Consider postponing water contact — bacterial contamination may be elevated.'
      : 'Avoid swimming and wading — bacterial contamination may be elevated downstream.';

  const forecastCsoCount = data.cso.advisoriesOnSelectedDate.count;

  return (
    <NuqsAdapter>
      {/*
       * CsoBanner — persistent top-of-page signal for CURRENT CSO state.
       * Shows active (live discharge) or residual (advisory window still in
       * effect today) regardless of which date chip is selected. Forecast
       * mode shows the active state only if there are real-time discharges;
       * the date-specific advisory appears in the in-content block below.
       */}
      <SevereWeatherBanner result={severeWeather} />
      <CsoBanner cso={data.cso} ageBucket={ageBucket} mode={data.mode} />
      <DateUnavailableBanner notice={notice} />

      <main>
      <PageContainer className="py-5">
        <header className="mb-5">
          <h1 className="text-2xl font-extrabold text-rva-blue leading-tight">RVA James</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            James River conditions for Richmond families.{' '}
            <Link href="/about" className="text-rva-blue underline">
              Learn more →
            </Link>
          </p>
        </header>

        {/*
         * First-visit safety banner — server-rendered conditionally
         * based on the `rva-james-safety-acknowledged` cookie. When
         * shown, it's part of the initial HTML so there's no
         * client-mount layout shift. Sized small enough that the
         * Richmond Conditions headline below still wins LCP.
         */}
        <FirstVisitBanner initiallyVisible={showFirstVisitBanner} />

        <ConditionsForm currentAge={ageBucket} chips={chips} />

        {/*
         * Active advisories — only shown for observed (today) mode.
         * These reflect current real-time conditions; displaying them on a
         * forecast date is misleading because they don't apply to that date.
         * Forecast-date CSO advisory surfaces in the block below.
         */}
        {data.mode === 'observed' && data.activeAdvisories.length > 0 && (
          <AdvisoriesBanner advisories={data.activeAdvisories} />
        )}

        {/*
         * Forecast CSO advisory — shown when the selected forecast date falls
         * within an advisory window. This is the date-specific counterpart to
         * the persistent CsoBanner above (which shows live discharge state).
         */}
        {data.mode === 'forecast' && forecastCsoCount > 0 && (
          <div className="rounded-xl p-4 mb-4 bg-status-caution text-status-caution-fg" role="status">
            <p className="font-semibold text-base mb-1">Sewer Overflow Advisory</p>
            <p className="text-sm px-1 py-1">
              {forecastCsoCount === 1
                ? '1 sewer overflow advisory covers this forecast date. '
                : `${forecastCsoCount} sewer overflow advisories cover this forecast date. `}
              {forecastCsoAction}
            </p>
          </div>
        )}

        {showStaleWarning && staleSnapshotAge !== null && (
          <div className="mb-4">
            <StaleState source="USGS" ageMinutes={staleSnapshotAge} />
          </div>
        )}

        {/*
         * ── Richmond Conditions section ── (sub-goal 90)
         *
         * Broad daily context above the river-specific panel:
         *   swim today · feels like + heat zone · next 4 hours · happiness
         *
         * Observed-mode only. On forecast dates the underlying rules-engine
         * inputs (live water temp, current humidity) aren't meaningful, so
         * the section is omitted; the forecast story stays with the metro
         * summary + location tiles below.
         *
         * Headline is the LCP-eligible deterministic text — paints from the
         * initial HTML and gives Chrome a strong text candidate near TTFB.
         * The FirstVisitModal LCP issue from sub-goal 67 was resolved in
         * sub-goal 91 by converting the modal to an inline banner with
         * compact text (see FirstVisitBanner.tsx).
         */}
        {richmondData && (
          <RichmondConditionsSection date={dateStr} ageBucket={ageBucket} data={richmondData} />
        )}

        {/*
         * ── Metro region ── Deterministic gauge panel renders instantly.
         *
         * Only shown for observed mode (i.e., today). The panel displays live
         * USGS gauge readings, which by definition don't apply to forecast
         * dates — leaving it visible on a forecast day caused the data to look
         * stuck when other parts of the page updated. The forecast date's
         * conditions surface through MetroSummaryPanel + location tiles below.
         */}
        {data.mode === 'observed' && (
          <RiverSegmentPanel metroState={metroState} />
        )}

        {/*
         * ── Metro AI summary ──
         * Now a client component (sub-goal 65) that fetches /api/metro-summary
         * after the deterministic content paints. The browser `load` event
         * no longer waits on AI streaming. Skeleton + spinner + status text
         * surface inside the component itself; no Suspense boundary needed.
         */}
        <MetroSummaryPanel date={dateStr} ageBucket={ageBucket} />

        {/* ── Locations region ── 9 deterministic cards */}
        <section aria-labelledby="locations-heading">
          <h2
            id="locations-heading"
            className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2"
          >
            Locations
          </h2>
          {!data.hasConditions ? (
            <>
              <EmptyState message="No gauge data yet — USGS updates every 15 minutes." />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                {data.locations.map((loc) => (
                  <RiverLevelTile key={loc.id} location={loc} dateStr={dateStr} ageBucket={ageBucket} />
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
              {data.locations.map((loc) => (
                <RiverLevelTile key={loc.id} location={loc} dateStr={dateStr} ageBucket={ageBucket} />
              ))}
            </div>
          )}
        </section>

        <DisclaimerFooter ageBucket={ageBucket} />
      </PageContainer>
      </main>
    </NuqsAdapter>
  );
}
