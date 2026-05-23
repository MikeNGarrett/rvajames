import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import type { LocationSummary } from '@/lib/queries/today';

interface Props {
  location: LocationSummary;
}

export function RiverLevelTile({ location }: Props) {
  const { status, label, reason } = location.deterministicStatus;

  const subtleClass = {
    safe:    'bg-status-safe-subtle border-status-safe',
    caution: 'bg-status-caution-subtle border-status-caution',
    danger:  'bg-status-danger-subtle border-status-danger',
  }[status] ?? 'bg-surface border-border';

  return (
    <Link href={`/locations/${location.slug}`} className={`block rounded-xl border p-4 ${subtleClass} touch-target`} aria-label={`${location.name} — ${label}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold text-text leading-tight">{location.name}</h2>
        <StatusBadge status={status} />
      </div>

      {location.latestGageFt !== null && (
        <div className="mb-2">
          <span className="text-3xl font-extrabold text-rva-blue">
            {location.latestGageFt.toFixed(1)}
          </span>
          <span className="text-sm font-medium text-text-secondary ml-1">ft</span>
          <span className="text-sm text-text-muted ml-2">— {label}</span>
        </div>
      )}

      {location.latestWaterTempF !== null && (
        <p className="text-sm text-text-secondary mb-2">
          Water {location.latestWaterTempF.toFixed(0)}°F
          {location.snapshotAge !== null && (
            <span className="text-text-muted"> · updated {location.snapshotAge}m ago</span>
          )}
        </p>
      )}

      <p className="text-sm text-text leading-snug">{reason}</p>

      <p className="text-xs text-rva-blue mt-2">
        Details &amp; resources →
      </p>
    </Link>
  );
}
