/**
 * WaterQualityPanel — sub-goal 71
 *
 * Displays the latest JRA bacteria reading for a location's mapped station.
 * Rules:
 *   - Volunteer site conditions are rendered VERBATIM — never sent to AI.
 *   - Site-average comparison is a deterministic string (no AI).
 *   - Enterococcus rendering is station-capability-aware:
 *       testsEnterococcus=false → "Not tested at this station"
 *       testsEnterococcus=true, value=null → "Sample pending"
 *       testsEnterococcus=true, value≠null → value + threshold context
 */

import type { WaterQualityReading } from '@/lib/queries/water-quality';
import { HorizontalGauge } from '@/components/ui/HorizontalGauge';

// ── Constants ─────────────────────────────────────────────────────────────────

const ECOLI_MAX   = 235;   // VDH single-sample recreational max (CFU/100mL)
const ENTERO_MAX  = 104;   // VDH single-sample recreational max (CFU/100mL)
const RECENCY_DAYS = 14;   // readings older than this are treated as off-season/stale

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  reading: WaterQualityReading;
  /** True when the station tests enterococcus (currently always false — all JRA stations E. coli–only). */
  testsEnterococcus: boolean;
}

// ── Pure helper functions ─────────────────────────────────────────────────────

/** Richmond season for seasonal context messaging. */
function getSeasonalContext(daysOld: number): 'fresh' | 'off-season' | 'stale' {
  if (daysOld <= RECENCY_DAYS) return 'fresh';
  const month = new Date().getMonth() + 1; // 1–12
  // Off-season: October through May
  if (month >= 10 || month <= 5) return 'off-season';
  // June–September but stale
  return 'stale';
}

/**
 * Deterministic comparative label for E. coli relative to the running average.
 * Returns null if either value is unavailable.
 */
function comparativeLabel(current: number, average: number): string {
  const ratio = (current - average) / Math.max(average, 1);
  if (ratio < -0.5) return 'much cleaner than usual';
  if (ratio < -0.2) return 'cleaner than usual';
  if (Math.abs(ratio) <= 0.2) return 'near the site average';
  if (ratio <= 0.5) return 'higher than usual';
  return 'much higher than usual';
}

/**
 * Format a Date in Richmond (ET) time as a human-readable date string.
 */
function formatReadingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Gauge max for E. coli — at least 2× the threshold, or 20% above the reading,
 * whichever is higher, so there's always some visual space beyond the value.
 */
function ecoliGaugeMax(value: number): number {
  return Math.max(ECOLI_MAX * 2, value * 1.2);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ThresholdBadge({ value, max, label }: { value: number; max: number; label: string }) {
  const exceeds = value >= max;
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
        exceeds
          ? 'bg-status-caution/20 text-status-caution-fg'
          : 'bg-status-safe/20 text-status-safe-fg'
      }`}
    >
      {exceeds ? `Exceeds ${label}` : `Within ${label}`}
    </span>
  );
}

function SecondaryStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WaterQualityPanel({ reading, testsEnterococcus }: Props) {
  const {
    stationName, organization, collectedAt, daysOld,
    ecoliCfuPer100ml, enterococciCfuPer100ml,
    ecoliAverage, waterTempF, airTempF, turbidity, salinity,
    siteConditions,
  } = reading;

  const seasonContext = getSeasonalContext(daysOld);

  return (
    <section
      aria-labelledby="wq-heading"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
    >
      <h2
        id="wq-heading"
        className="text-sm font-semibold text-text-secondary mb-1 uppercase tracking-wide"
      >
        Water Quality
      </h2>
      <p className="text-xs text-text-muted mb-3">
        {stationName}
      </p>

      {/* ── Seasonal context messaging ──────────────────────────────────── */}
      {seasonContext === 'off-season' && (
        <div className="rounded-lg bg-surface border border-border p-3 mb-4 text-sm text-text-secondary">
          <p className="font-medium mb-1">Sampling is paused for the season.</p>
          <p className="text-xs text-text-muted">
            James River Watch volunteers collect samples on Thursdays between Memorial Day and
            Labor Day. Last sample: {formatReadingDate(collectedAt)}.
            Sampling resumes around Memorial Day.
          </p>
        </div>
      )}

      {seasonContext === 'stale' && (
        <div className="rounded-lg bg-status-caution/10 border border-status-caution/30 p-3 mb-4 text-sm">
          <p className="text-status-caution-fg font-medium">
            Most recent sample is {daysOld} day{daysOld !== 1 ? 's' : ''} old
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            Typical sampling cadence is weekly (Thursdays, Memorial Day–Labor Day).
          </p>
        </div>
      )}

      {/* ── E. coli reading ───────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-text">E. coli</span>
          {ecoliCfuPer100ml !== null && (
            <ThresholdBadge value={ecoliCfuPer100ml} max={ECOLI_MAX} label="VDH limit" />
          )}
        </div>

        {ecoliCfuPer100ml !== null ? (
          <>
            <p className="text-2xl font-extrabold text-rva-blue mb-0.5">
              {ecoliCfuPer100ml.toLocaleString()}
              <span className="text-sm font-normal ml-1 text-text-muted">CFU/100mL</span>
            </p>
            <p className="text-xs text-text-muted mb-2">
              VDH single-sample limit: {ECOLI_MAX} CFU/100mL
              {ecoliAverage !== null && ecoliCfuPer100ml !== null && (
                <> · {comparativeLabel(ecoliCfuPer100ml, ecoliAverage)}</>
              )}
            </p>
            <HorizontalGauge
              value={ecoliCfuPer100ml}
              min={0}
              max={ecoliGaugeMax(ecoliCfuPer100ml)}
              normalBand={{ low: 0, high: ECOLI_MAX }}
              criticalBand={{ low: ECOLI_MAX, high: ecoliGaugeMax(ecoliCfuPer100ml) }}
              ariaLabel={`E. coli ${ecoliCfuPer100ml} CFU/100mL — ${
                ecoliCfuPer100ml >= ECOLI_MAX ? 'exceeds' : 'within'
              } VDH limit of ${ECOLI_MAX}`}
              bandLabels={[
                { value: 0,        label: '0' },
                { value: ECOLI_MAX, label: '235 limit' },
              ]}
            />
          </>
        ) : (
          <p className="text-sm text-text-muted">Not measured in this sample.</p>
        )}
      </div>

      {/* ── Enterococcus (station-capability-aware) ──────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-text">Enterococcus</span>
          {testsEnterococcus && enterococciCfuPer100ml !== null && (
            <ThresholdBadge value={enterococciCfuPer100ml} max={ENTERO_MAX} label="VDH limit" />
          )}
        </div>

        {!testsEnterococcus ? (
          <p className="text-xs text-text-muted italic">
            Not tested at this station — single-bacteria site (E. coli only).
          </p>
        ) : enterococciCfuPer100ml !== null ? (
          <>
            <p className="text-2xl font-extrabold text-rva-blue mb-0.5">
              {enterococciCfuPer100ml.toLocaleString()}
              <span className="text-sm font-normal ml-1 text-text-muted">CFU/100mL</span>
            </p>
            <p className="text-xs text-text-muted mb-2">
              VDH single-sample limit: {ENTERO_MAX} CFU/100mL
            </p>
            <HorizontalGauge
              value={enterococciCfuPer100ml}
              min={0}
              max={Math.max(ENTERO_MAX * 2, enterococciCfuPer100ml * 1.2)}
              normalBand={{ low: 0, high: ENTERO_MAX }}
              criticalBand={{ low: ENTERO_MAX, high: Math.max(ENTERO_MAX * 2, enterococciCfuPer100ml * 1.2) }}
              ariaLabel={`Enterococcus ${enterococciCfuPer100ml} CFU/100mL — ${
                enterococciCfuPer100ml >= ENTERO_MAX ? 'exceeds' : 'within'
              } VDH limit of ${ENTERO_MAX}`}
              bandLabels={[
                { value: 0,         label: '0' },
                { value: ENTERO_MAX, label: '104 limit' },
              ]}
            />
          </>
        ) : (
          <p className="text-sm text-text-muted">Sample pending.</p>
        )}
      </div>

      {/* ── Secondary stats ─────────────────────────────────────────────────
        *
        * IMPORTANT: these values are observed at sample collection time
        * (typically Thursdays, Memorial Day–Labor Day), NOT live readings.
        * The Current Conditions block at the top of the location page shows
        * live USGS gauge data for water temp; the two can disagree when the
        * sample is hours/days old. The h3 heading below makes that explicit
        * so a reader scanning top-to-bottom doesn't see the same metric name
        * with different values and wonder which is right.
        */}
      {(waterTempF !== null || airTempF !== null || turbidity !== null || salinity !== null) && (
        <div className="border-t border-border pt-3 mb-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Observations at sample collection
          </h3>
          <p className="text-xs text-text-muted mb-2">
            Recorded {daysOld === 0 ? 'today' : `${daysOld} day${daysOld !== 1 ? 's' : ''} ago`} on {formatReadingDate(collectedAt)}.
            For live water temperature, see Current Conditions above.
          </p>
          <div className="space-y-1.5">
            {waterTempF !== null && (
              <SecondaryStatRow label="Water temp" value={`${waterTempF.toFixed(1)} °F`} />
            )}
            {airTempF !== null && (
              <SecondaryStatRow label="Air temp" value={`${airTempF.toFixed(1)} °F`} />
            )}
            {turbidity !== null && (
              <SecondaryStatRow label="Turbidity" value={`${turbidity.toFixed(1)} NTU`} />
            )}
            {salinity !== null && (
              <SecondaryStatRow label="Salinity" value={`${salinity.toFixed(2)} ppt`} />
            )}
          </div>
        </div>
      )}

      {/* ── Volunteer site conditions (verbatim — no AI) ─────────────────── */}
      {siteConditions && (
        <blockquote className="border-l-2 border-rva-blue/30 pl-3 mb-4">
          <p className="text-sm text-text-secondary italic leading-relaxed">
            &ldquo;{siteConditions}&rdquo;
          </p>
          <footer className="text-xs text-text-muted mt-1">
            — Volunteer site note, {formatReadingDate(collectedAt)}
          </footer>
        </blockquote>
      )}

      {/* ── Sample attribution ────────────────────────────────────────────── */}
      <p className="text-xs text-text-muted">
        Sampled {daysOld === 0 ? 'today' : `${daysOld} day${daysOld !== 1 ? 's' : ''} ago`}
        {' '}on {formatReadingDate(collectedAt)}
        {organization ? ` by ${organization}` : ''}.
      </p>

      {/* ── Attribution ──────────────────────────────────────────────────── */}
      <p className="text-xs text-text-muted mt-2">
        Data from{' '}
        <a
          href="https://thejamesriver.org/james-river-watch/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          James River Watch<span className="sr-only"> (opens in new tab)</span>
        </a>.{' '}
        VDH Bacteria Action Values apply. Recreational water guidance is a single-sample
        threshold — not a guarantee of safety.
      </p>
    </section>
  );
}
