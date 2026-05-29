import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import type { LocationSummary } from '@/lib/queries/today';

interface Props {
  location: LocationSummary;
}

/**
 * Small amber circle with "!" shown on tiles when there is an active CSO
 * upstream of this access point in the past 48 hours.
 *
 * A11y: aria-label on the <span> covers screen readers. The circle shape
 * differs from WaterDropBadge so the two badges are distinguishable by
 * shape alone (WCAG 1.4.1).
 */
function CsoBadge() {
  return (
    <span
      aria-label="CSO event upstream in past 48 hours"
      title="Upstream sewer overflow — bacterial levels may be elevated"
      className="inline-flex items-center shrink-0 text-status-caution-fg"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 10 10"
        className="w-3 h-3"
        fill="currentColor"
      >
        <circle cx="5" cy="5" r="5" />
        <text
          x="5"
          y="7.8"
          textAnchor="middle"
          fontSize="7"
          fontWeight="900"
          fill="white"
        >
          !
        </text>
      </svg>
    </span>
  );
}

/**
 * Small water-drop indicator shown alongside the status pill when a fresh
 * JRA water-quality reading is available.
 *   - Blue drop:  within VDH thresholds (safe)
 *   - Amber drop with "!" mark: exceeds VDH single-sample max (caution)
 *
 * A11y: aria-label on the <span> covers screen readers. The "!" glyph inside
 * the caution SVG is a shape-based distinction so colorblind users don't rely
 * solely on hue to distinguish the two states (WCAG 1.4.1).
 */
function WaterDropBadge({ status }: { status: 'safe' | 'caution' }) {
  const isCaution = status === 'caution';
  return (
    <span
      aria-label={`Water quality: ${isCaution ? 'elevated bacteria' : 'safe'}`}
      title={`Water quality: ${isCaution ? 'Bacteria above VDH limit' : 'Within VDH safe range'}`}
      className={`inline-flex items-center shrink-0 ${
        isCaution ? 'text-status-caution-fg' : 'text-rva-blue/60'
      }`}
    >
      {/* Water-drop SVG. Caution state adds an "!" glyph inside the drop
          so the two states differ by shape as well as color. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 8 11"
        className="w-2.5 h-3.5"
        fill="currentColor"
      >
        <path d="M4 0 C3 2 0 5.5 0 7.5 a4 4 0 0 0 8 0 C8 5.5 5 2 4 0 Z" />
        {isCaution && (
          <text
            x="4"
            y="9.5"
            textAnchor="middle"
            fontSize="5"
            fontWeight="900"
            fill="white"
          >
            !
          </text>
        )}
      </svg>
    </span>
  );
}

export function RiverLevelTile({ location }: Props) {
  const { status, reason } = location.deterministicStatus;

  const subtleClass = {
    safe:    'bg-status-safe-subtle border-status-safe',
    caution: 'bg-status-caution-subtle border-status-caution',
    danger:  'bg-status-danger-subtle border-status-danger',
    closed:  'bg-status-closed-subtle border-status-closed/40',
  }[status] ?? 'bg-surface border-border';

  return (
    <Link
      href={`/locations/${location.slug}`}
      className={`flex flex-col gap-2 rounded-xl border p-4 ${subtleClass} touch-target`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-text leading-tight">{location.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {location.upstreamCso && location.upstreamCso.count > 0 && (
            <CsoBadge />
          )}
          {location.waterQuality && (
            <WaterDropBadge status={location.waterQuality.status} />
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
