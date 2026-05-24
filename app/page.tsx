import { Suspense } from 'react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { searchParamsCache, isValidAgeBucket, formatDateParam, type AgeBucket } from '@/lib/url-state';
import { getTodayData } from '@/lib/queries/today';
import { getMetroRiverState } from '@/lib/queries/river-segment';
import { RiverLevelTile } from '@/components/tiles/RiverLevelTile';
import { AdvisoriesBanner } from '@/components/tiles/AdvisoriesBanner';
import { FloodBanner } from '@/components/banners/FloodBanner';
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

  // Fetch deterministic data in parallel — these render immediately
  const [data, metroState] = await Promise.all([
    getTodayData(dateStr, ageBucket),
    getMetroRiverState(ageBucket),
  ]);

  const hasFlood = data.activeAdvisories.some((a) => a.kind === 'flood_warning');

  const staleSnapshotAge = data.locations[0]?.snapshotAge ?? null;
  const showStaleWarning = staleSnapshotAge !== null && isStale('usgs', staleSnapshotAge);

  const todayStr = formatDateParam(new Date());
  const isFuture = dateStr > todayStr;

  return (
    <NuqsAdapter>
      {hasFlood && <FloodBanner />}
      <FirstVisitModal />

      <main>
      <PageContainer className="py-5">
        <header className="mb-5">
          <h1 className="text-2xl font-extrabold text-rva-blue leading-tight">RVA James</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            James River conditions for Richmond families
          </p>
        </header>

        <ConditionsForm currentDate={dateStr} currentAge={ageBucket} />

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
        {!isFuture && (
          <Suspense fallback={<MetroSummaryPanelSkeleton />}>
            <MetroSummaryPanel date={dateStr} ageBucket={ageBucket} />
          </Suspense>
        )}

        {/* ── Locations region ── 9 deterministic cards */}
        <section aria-labelledby="locations-heading">
          <h2
            id="locations-heading"
            className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2"
          >
            Locations
          </h2>
          {isFuture ? (
            <EmptyState message="No forecast data yet for future dates. Check back on the day of your visit." />
          ) : !data.hasConditions ? (
            <>
              <EmptyState message="No gauge data yet — USGS updates every 15 minutes." />
              <div className="mt-4 grid gap-3">
                {data.locations.map((loc) => (
                  <RiverLevelTile key={loc.id} location={loc} />
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-3">
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
