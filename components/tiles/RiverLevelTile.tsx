import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import { LocationStatusRow } from '@/components/ui/LocationStatusRow';
import { ActivityChipRow } from '@/components/ui/ActivityChipRow';
import type { LocationSummary } from '@/lib/queries/today';
import type { AgeBucket } from '@/lib/url-state';

interface Props {
  location: LocationSummary;
  /**
   * Current date param (YYYY-MM-DD in Richmond ET). Forwarded to the location
   * detail page via the tile's href so users don't lose forecast context when
   * clicking from the homepage's "Mon, Jun 1" chip into Belle Isle. The detail
   * page also reads this from the URL to seed its own ConditionsForm.
   */
  dateStr: string;
  /** Current age bucket. Forwarded for the same reason as dateStr. */
  ageBucket: AgeBucket;
}

// Layout history
//   2026-06-03 → 2026-06-04 redesign round:
//     - Inline WaterDropBadge replaced by reusable <WaterQualityIcon>
//       (24×24 viewBox, large centered "!" in caution state — old badge
//       was 10×14 px and hard to read at a glance)
//     - Inline CsoBadge extracted to components/ui/CsoBadge.tsx so the
//       new LocationStatusRow can reuse the same amber-circle visual
//     - Environmental indicators moved out of the title cluster into a
//       dedicated <LocationStatusRow>, freeing the title row to carry
//       just the operational pill
//     - Per-activity verdicts added via <ActivityChipRow> reading from
//       location.activities (populated by the resolver layer; see
//       lib/safety/location-activities.ts + lib/queries/today.ts)
//
// Closure-mode rendering (2026-06-03 design decision)
//   - Open (status === 'safe'): hide the StatusBadge — redundant with
//     the lack of warnings — show all three rows.
//   - Restricted (caution / danger): keep the badge, show all rows.
//   - Closed (closed): keep the badge, show ONLY the closure reason —
//     no environmental indicators, no activity chips. The location
//     isn't accessible, so the rest is noise.

export function RiverLevelTile({ location, dateStr, ageBucket }: Props) {
  const { status, reason } = location.deterministicStatus;

  // Tile background + border — keyed off the deterministic status. The
  // ?? fallback handles the (unused) 'flood' status from StatusBadge's
  // type union, plus any future status the rules engine adds.
  const subtleClass = {
    safe:    'bg-status-safe-subtle border-status-safe',
    caution: 'bg-status-caution-subtle border-status-caution',
    danger:  'bg-status-danger-subtle border-status-danger',
    closed:  'bg-status-closed-subtle border-status-closed/40',
  }[status] ?? 'bg-surface border-border';

  const showStatusPill = status !== 'safe';
  const isClosed       = status === 'closed';

  return (
    <Link
      // encodeURIComponent on age: the '14+' bucket contains a '+' which the
      // URL spec decodes as a space in query strings — without encoding, the
      // server reads age='14 ' and fails validation.
      href={`/locations/${location.slug}?date=${dateStr}&age=${encodeURIComponent(ageBucket)}`}
      className={`flex flex-col gap-2 rounded-xl border p-4 ${subtleClass} touch-target`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-text leading-tight">{location.name}</h3>
        {showStatusPill && (
          <div className="shrink-0">
            <StatusBadge status={status} />
          </div>
        )}
      </div>

      <p className="text-sm text-text leading-snug">{reason}</p>

      {!isClosed && (
        <>
          <LocationStatusRow
            waterQuality={location.waterQuality}
            upstreamCso={location.upstreamCso}
          />
          <ActivityChipRow activities={location.activities} />
        </>
      )}

      <p className="text-xs text-rva-blue mt-auto">
        Details &amp; resources →
      </p>
    </Link>
  );
}
