import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import { WaterQualityIcon } from '@/components/ui/WaterQualityIcon';
import { CsoBadge } from '@/components/ui/CsoBadge';
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

// Note: CsoBadge was extracted 2026-06-04 to components/ui/CsoBadge.tsx so
// LocationStatusRow (and any future tile variant) can reuse the same
// amber-circle-with-"!" visual. Imported above.
//
// Note: the prior inline WaterDropBadge here was replaced 2026-06-03 by the
// reusable <WaterQualityIcon> in components/ui/. The old badge rendered too
// small (10x14 px) to distinguish safe vs caution at a glance; the new
// component uses a 24x24 viewBox with a large centered "!" in the caution
// state and supports multiple sizes via a `size` prop.

export function RiverLevelTile({ location, dateStr, ageBucket }: Props) {
  const { status, reason } = location.deterministicStatus;

  const subtleClass = {
    safe:    'bg-status-safe-subtle border-status-safe',
    caution: 'bg-status-caution-subtle border-status-caution',
    danger:  'bg-status-danger-subtle border-status-danger',
    closed:  'bg-status-closed-subtle border-status-closed/40',
  }[status] ?? 'bg-surface border-border';

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
        <div className="flex items-center gap-1.5 shrink-0">
          {location.upstreamCso && location.upstreamCso.count > 0 && (
            <CsoBadge />
          )}
          {location.waterQuality && (
            <WaterQualityIcon status={location.waterQuality.status} size={18} />
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      <p className="text-sm text-text leading-snug">{reason}</p>

      <p className="text-xs text-rva-blue mt-auto">
        Details &amp; resources →
      </p>
    </Link>
  );
}
