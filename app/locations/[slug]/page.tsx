import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { Metadata } from 'next';
import { getLocationDetail } from '@/lib/queries/location';
import { searchParamsCache, isValidAgeBucket, formatDateParam, type AgeBucket } from '@/lib/url-state';
import { isInWindow, resolveDateMode, formatForecastDate } from '@/lib/queries/date-range';
import { ForecastModeIndicator } from '@/components/forecast/ForecastModeIndicator';
import { OutOfWindowError } from '@/lib/queries/today';
import { buildRedirectUrl } from '@/lib/utils/redirect-to-today';
import { ActivityMatrix } from '@/components/location/ActivityMatrix';
import { WaterQualityPanel } from '@/components/location/WaterQualityPanel';
import { UpstreamCsoPanel } from '@/components/location/UpstreamCsoPanel';
import { PrepChecklist } from '@/components/trip/PrepChecklist';
import { ResourceList } from '@/components/location/ResourceList';
import { AdvisoriesBanner } from '@/components/tiles/AdvisoriesBanner';
import { DateUnavailableBanner } from '@/components/banners/DateUnavailableBanner';
import { StatusBadge } from '@/components/tiles/StatusBadge';
import { StaleState } from '@/components/states/Stale';
import { DisclaimerFooter } from '@/components/legal/DisclaimerFooter';
import { isStale } from '@/lib/freshness';

// Always render dynamically — live gauge data and lazy AI generation make static
// pre-rendering pointless, and generateStaticParams returning [] at build time
// (local Supabase unreachable) caused ambiguous caching behaviour.
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const titleMap: Record<string, string> = {
    'belle-isle': 'Belle Isle',
    'pony-pasture': 'Pony Pasture Rapids',
    'texas-beach': 'Texas Beach',
    'browns-island': 'Browns Island',
    'mayo-island': 'Mayo Island',
    'shiplock-trail': 'Shiplock Trail',
    'north-bank-trail': 'North Bank Trail',
    'buttermilk-trail': 'Buttermilk Trail',
    'pump-house': 'Pump House',
  };
  const name = titleMap[slug] ?? slug;
  return {
    title: `${name} — RVA James`,
    description: `Current James River conditions at ${name} for Richmond families.`,
    openGraph: {
      title: `${name} — RVA James`,
      description: `Current conditions and family activity guide for ${name}.`,
    },
  };
}

export default async function LocationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = await searchParams;
  const { date, age } = searchParamsCache.parse(raw);
  const ageBucket: AgeBucket = isValidAgeBucket(age) ? age : '6-9';
  // date is null when ?date= is absent. Substitute a fresh per-request Date
  // here rather than relying on a module-init default on the cache (which
  // would go stale on warm Workers — see lib/url-state.ts).
  const dateStr = formatDateParam(date ?? new Date());

  // ── Proactive guard: redirect out-of-window dates before hitting the DB ──
  if (!isInWindow(dateStr)) {
    redirect(buildRedirectUrl(`/locations/${slug}`, raw));
  }

  // ── Notice banner ──
  const notice = typeof raw.notice === 'string' ? raw.notice : undefined;

  let location;
  try {
    location = await getLocationDetail(slug, dateStr, ageBucket);
  } catch (err) {
    if (err instanceof OutOfWindowError) {
      redirect(buildRedirectUrl(`/locations/${slug}`, raw));
    }
    console.error(`[/locations/${slug}] getLocationDetail threw:`, err);
    throw err;
  }
  if (!location) notFound();

  const status = location.deterministicStatus.status;
  const isDataStale = location.latestSnapshot
    ? isStale('usgs', location.latestSnapshot.ageMinutes)
    : false;
  const { mode, forecastConfidence } = resolveDateMode(dateStr);
  const dateLabel = mode === 'forecast' ? formatForecastDate(dateStr) : null;

  return (
    <NuqsAdapter>
      <DateUnavailableBanner notice={notice} />
      <main className="max-w-lg mx-auto px-4 py-5">
        {/* Back nav */}
        <Link
          href={`/?date=${dateStr}&age=${ageBucket}`}
          className="touch-target inline-flex items-center text-sm text-rva-blue mb-4"
        >
          ← All locations
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h1 className="text-2xl font-extrabold text-text">{location.name}</h1>
          <StatusBadge status={status} />
        </div>

        {location.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {location.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-surface text-text-muted text-xs border border-border"
              >
                {tag.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Advisories */}
        {location.activeAdvisories.length > 0 && (
          <AdvisoriesBanner advisories={location.activeAdvisories} />
        )}

        {/* Stale warning */}
        {isDataStale && location.latestSnapshot && (
          <div className="mb-4">
            <StaleState source="USGS" ageMinutes={location.latestSnapshot.ageMinutes} />
          </div>
        )}

        {/* Current conditions */}
        {location.latestSnapshot && (
          <section className="rounded-xl border border-border bg-surface-raised p-4 mb-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">
              {mode === 'forecast' ? 'Forecast conditions' : 'Current conditions'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {location.latestSnapshot.gageFt !== null && (
                <div>
                  <p className="text-3xl font-extrabold text-rva-blue">
                    {location.latestSnapshot.gageFt.toFixed(1)}
                    <span className="text-base font-medium ml-1">ft</span>
                  </p>
                  <p className="text-xs text-text-muted">Gage height</p>
                </div>
              )}
              {location.latestSnapshot.waterTempF !== null && (
                <div>
                  <p className="text-3xl font-extrabold text-rva-blue">
                    {location.latestSnapshot.waterTempF.toFixed(0)}
                    <span className="text-base font-medium ml-0.5">°F</span>
                  </p>
                  <p className="text-xs text-text-muted">Water temp</p>
                </div>
              )}
              {location.latestSnapshot.dischargeCfs !== null && (
                <div>
                  <p className="text-xl font-bold text-text">
                    {location.latestSnapshot.dischargeCfs.toLocaleString()}
                    <span className="text-sm font-medium ml-1">cfs</span>
                  </p>
                  <p className="text-xs text-text-muted">Discharge</p>
                </div>
              )}
              {location.latestSnapshot.airTempF !== null && (
                <div>
                  <p className="text-xl font-bold text-text">
                    {location.latestSnapshot.airTempF.toFixed(0)}
                    <span className="text-sm font-medium ml-0.5">°F</span>
                  </p>
                  <p className="text-xs text-text-muted">Air temp</p>
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted mt-3">
              Updated {location.latestSnapshot.ageMinutes}m ago · USGS station 02037500
            </p>
          </section>
        )}

        {/* AI interpretation */}
        {location.interpretation && (
          <section className="rounded-xl border border-border bg-surface-raised p-4 mb-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              {mode === 'forecast' && dateLabel ? `Forecast for ${dateLabel}` : 'Conditions summary'}
            </h2>
            {mode === 'forecast' && (
              <ForecastModeIndicator mode={mode} forecastConfidence={forecastConfidence} />
            )}
            <p className={`text-base font-medium text-text mb-2${mode === 'forecast' ? ' mt-2' : ''}`}>
              {location.interpretation.headline}
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {location.interpretation.body_md.replace(/[*#`]/g, '')}
            </p>
            <p className="text-xs text-text-muted italic mt-2">
              Use your judgment — conditions can change fast.
            </p>
          </section>
        )}

        {/* Water quality panel */}
        {location.waterQuality && (
          <WaterQualityPanel
            reading={location.waterQuality.reading}
            testsEnterococcus={location.waterQuality.testsEnterococcus}
          />
        )}

        {/* Upstream CSO panel */}
        {location.upstreamCso && (
          <UpstreamCsoPanel
            upstreamCso={location.upstreamCso}
            mode={mode}
            ageBucket={ageBucket}
            selectedDate={dateStr}
          />
        )}

        {/* Activity matrix */}
        {location.interpretation?.activities && (
          <div className="mb-4">
            <ActivityMatrix
              activities={
                location.interpretation.activities as {
                  slug: string;
                  status: 'safe' | 'caution' | 'deny';
                  note: string;
                }[]
              }
            />
          </div>
        )}

        {/* Trip prep checklist */}
        {location.interpretation?.prep_items && location.interpretation.prep_items.length > 0 && (
          <div className="mb-4">
            <PrepChecklist
              items={location.interpretation.prep_items}
              storageKey={`prep-${slug}-${dateStr}-${ageBucket}`}
            />
          </div>
        )}

        {/* Attribution */}
        {location.interpretation?.attribution?.length && (
          <p className="text-xs text-text-muted mb-4">
            Sources: {location.interpretation.attribution.join(', ')}
          </p>
        )}

        {/* Resource links */}
        {location.resources.length > 0 && (
          <div className="mb-4">
            <ResourceList resources={location.resources} />
          </div>
        )}

        <DisclaimerFooter ageBucket={ageBucket} />
      </main>
    </NuqsAdapter>
  );
}
