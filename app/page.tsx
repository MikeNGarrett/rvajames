import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { searchParamsCache, isValidAgeBucket, formatDateParam, type AgeBucket } from '@/lib/url-state';
import { getTodayData, OutOfWindowError } from '@/lib/queries/today';
import { getMetroRiverState } from '@/lib/queries/river-segment';
import { getForecastWindow, isInWindow } from '@/lib/queries/date-range';
import { buildRedirectUrl } from '@/lib/utils/redirect-to-today';
import { RiverLevelTile } from '@/components/tiles/RiverLevelTile';
import { AdvisoriesBanner } from '@/components/tiles/AdvisoriesBanner';
import { FloodBanner } from '@/components/banners/FloodBanner';
import { DateUnavailableBanner } from '@/components/banners/DateUnavailableBanner';
import { DisclaimerFooter } from '@/components/legal/DisclaimerFooter';
import { FirstVisitModal } from '@/components/legal/FirstVisitModal';
import { ConditionsForm } from '@/components/filters/ConditionsForm';
import { EmptyState } from '@/components/states/Empty';
import { StaleState } from '@/components/states/Stale';
import { RiverSegmentPanel } from '@/components/metro/RiverSegmentPanel';
import { MetroSummaryPanel, MetroSummaryPanelSkeleton } from '@/components/metro/MetroSummaryPanel';
import { PageContainer } from '@/components/ui/PageContainer';
import { isStale } from '@/lib/freshness';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const { date, age } = searchParamsCache.parse(params);
  const ageBucket: AgeBucket = isValidAgeBucket(age) ? age : '6-9';
  const dateStr = formatDateParam(date);

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

  const hasFlood = data.activeAdvisories.some((a) => a.kind === 'flood_warning');

  const staleSnapshotAge = data.locations[0]?.snapshotAge ?? null;
  const showStaleWarning = staleSnapshotAge !== null && isStale('usgs', staleSnapshotAge);

  return (
    <NuqsAdapter>
      {hasFlood && <FloodBanner />}
      <DateUnavailableBanner notice={notice} />
      <FirstVisitModal />

      <main>
      <PageContainer className="py-5">
        <header className="mb-5">
          <h1 className="text-2xl font-extrabold text-rva-blue leading-tight">RVA James</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            James River conditions for Richmond families
          </p>
        </header>

        <ConditionsForm currentAge={ageBucket} chips={chips} />

        {data.activeAdvisories.length > 0 && (
          <AdvisoriesBanner advisories={data.activeAdvisories} />
        )}

        {showStaleWarning && staleSnapshotAge !== null && (
          <div className="mb-4">
            <StaleState source="USGS" ageMinutes={staleSnapshotAge} />
          </div>
        )}

        {/* ── Metro region ── Deterministic gauge panel renders instantly */}
        <RiverSegmentPanel metroState={metroState} />

        {/* ── Metro AI summary ── Suspense boundary so cards below render immediately */}
        <Suspense fallback={<MetroSummaryPanelSkeleton />}>
          <MetroSummaryPanel date={dateStr} ageBucket={ageBucket} />
        </Suspense>

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
                  <RiverLevelTile key={loc.id} location={loc} />
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
              {data.locations.map((loc) => (
                <RiverLevelTile key={loc.id} location={loc} />
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
