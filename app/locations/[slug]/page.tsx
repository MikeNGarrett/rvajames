import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { Metadata } from 'next';
import { getLocationDetail } from '@/lib/queries/location';
import { searchParamsCache, isValidAgeBucket, type AgeBucket } from '@/lib/url-state';
import { formatRichmondDate } from '@/lib/utils/date-tz';
import { isInWindow, resolveDateMode, formatForecastDate, getForecastWindow } from '@/lib/queries/date-range';
import { ConditionsForm } from '@/components/filters/ConditionsForm';
import { OutOfWindowError } from '@/lib/queries/today';
import { buildRedirectUrl } from '@/lib/utils/redirect-to-today';
import { WaterQualityPanel } from '@/components/location/WaterQualityPanel';
import { UpstreamCsoPanel } from '@/components/location/UpstreamCsoPanel';
import { ResourceList } from '@/components/location/ResourceList';
import { LocationInterpretationProvider } from '@/components/location/LocationInterpretationProvider';
import {
  LocationInterpretationSummary,
  LocationActivityMatrix,
  LocationPrepChecklist,
  LocationAttribution,
} from '@/components/location/LocationInterpretationSections';
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
  // date is null when ?date= is absent. The URL param is already a Richmond-time
  // YYYY-MM-DD string (set by the date chips), so use it directly. Fall back to
  // formatRichmondDate(new Date()) per-request (see lib/url-state.ts).
  const dateStr = date ?? formatRichmondDate(new Date());

  // ── Proactive guard: redirect out-of-window dates before hitting the DB ──
  if (!isInWindow(dateStr)) {
    redirect(buildRedirectUrl(`/locations/${slug}`, raw));
  }

  // ── Forecast chips (server-computed, passed to ConditionsForm) ──
  // Mirrors app/page.tsx so the location detail page exposes the same
  // date/age controls as the homepage. nuqs setters with shallow:false
  // trigger an RSC re-render against the new params on this same route.
  const chips = getForecastWindow();

  // ── Notice banner ──
  const notice = typeof raw.notice === 'string' ? raw.notice : undefined;

  let location;
  try {
    // sub-goal 66: skip the AI call in the server render. The page now
    // delegates interpretation fetching to the client via
    // <LocationInterpretationProvider>. The deterministic slice (snapshot,
    // advisories, water quality, upstream CSO, resources) still renders
    // server-side as before.
    location = await getLocationDetail(slug, dateStr, ageBucket, {
      skipInterpretation: true,
    });
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
          href={`/?date=${dateStr}&age=${encodeURIComponent(ageBucket)}`}
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

        {/*
         * Date + age filters. Same control surface as the homepage so users
         * can change either dimension without bouncing back to /. The form's
         * nuqs setters use shallow:false, which re-runs this server component
         * with the updated searchParams.
         */}
        <ConditionsForm currentAge={ageBucket} chips={chips} />

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

        {/*
         * AI-driven sections + deterministic panels wrapped in a shared
         * client-side fetch provider (sub-goal 66). The provider does ONE
         * call to /api/location-interpretation; each AI-dependent consumer
         * (summary, activity matrix, prep checklist, attribution) reads the
         * shared state via context.
         *
         * Order matches the pre-migration page so the user sees the same
         * layout: AI narrative → water quality → upstream CSO → activity
         * matrix → prep checklist → attribution. The deterministic
         * components (WaterQualityPanel, UpstreamCsoPanel) sit inside the
         * provider tree but don't consume context, so they render
         * immediately from server data.
         */}
        <LocationInterpretationProvider
          slug={slug}
          date={dateStr}
          ageBucket={ageBucket}
        >
          <LocationInterpretationSummary
            mode={mode}
            dateLabel={dateLabel}
            forecastConfidence={forecastConfidence}
          />

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

          <LocationActivityMatrix />

          <LocationPrepChecklist
            storageKey={`prep-${slug}-${dateStr}-${ageBucket}`}
          />

          <LocationAttribution />
        </LocationInterpretationProvider>

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
