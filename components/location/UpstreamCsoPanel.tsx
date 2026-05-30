/**
 * UpstreamCsoPanel — sub-goal 84
 *
 * Displays upstream CSO (combined sewer overflow) events detected within the
 * past 48 hours at outfalls upstream of this access point. Rendered only when
 * count > 0; callers should not render it when upstreamCso is null.
 *
 * Pattern mirrors WaterQualityPanel: section with h2 heading, amber caution
 * block, outfall list, and EmNet attribution link.
 *
 * Data source: Richmond DPU overflow events via EmNet public map.
 * No AI — all content is deterministic from the advisory rows.
 */

import type { UpstreamCsoSignal } from '@/lib/safety/upstream-cso';

interface Props {
  upstreamCso: UpstreamCsoSignal;
}

export function UpstreamCsoPanel({ upstreamCso }: Props) {
  // Callers pass a non-null signal; defensive early exit for count === 0.
  if (upstreamCso.count === 0) return null;

  const { count } = upstreamCso;

  return (
    <section
      aria-labelledby="cso-heading"
      className="rounded-xl border border-border bg-surface-raised p-4 mb-4"
    >
      <h2
        id="cso-heading"
        className="text-sm font-semibold text-text-secondary mb-1 uppercase tracking-wide"
      >
        Upstream Sewer Overflow
      </h2>

      {/* Amber caution block */}
      <div className="rounded-lg bg-status-caution/10 border border-status-caution/30 p-3 mb-4 text-sm">
        <p className="text-status-caution-fg font-medium">
          {count} sewer overflow{count !== 1 ? 's' : ''} upstream of this location in the past 48 hours.
          Bacterial contamination may be elevated downstream — consider postponing water contact.
        </p>
      </div>

      {/* Attribution */}
      <p className="text-xs text-text-muted">
        Overflow data from{' '}
        <a
          href="https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Richmond DPU via EmNet<span className="sr-only"> (opens in new tab)</span>
        </a>
        . Upstream determination is approximate (longitude-based). Data is updated
        periodically — check EmNet for the most current status.
      </p>
    </section>
  );
}
