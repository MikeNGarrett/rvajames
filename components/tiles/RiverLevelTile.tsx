import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import type { LocationSummary } from '@/lib/queries/today';

interface Props {
  location: LocationSummary;
}

/**
 * Small water-drop indicator shown alongside the status pill when a fresh
 * JRA water-quality reading is available.
 *   - Blue drop:  within VDH thresholds (safe)
 *   - Amber drop: exceeds VDH single-sample max (caution)
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
      {/* Simple water-drop SVG */}
      <svg
        aria-hidden="true"
        viewBox="0 0 8 11"
        className="w-2.5 h-3.5"
        fill="currentColor"
      >
        <path d="M4 0 C3 2 0 5.5 0 7.5 a4 4 0 0 0 8 0 C8 5.5 5 2 4 0 Z" />
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
