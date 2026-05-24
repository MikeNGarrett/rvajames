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
    <Link
      href={`/locations/${location.slug}`}
      className={`block rounded-xl border p-4 ${subtleClass} touch-target`}
      aria-label={`${location.name}: ${label}. ${reason}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-text leading-tight">{location.name}</h3>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-text leading-snug">{reason}</p>

      <p className="text-xs text-rva-blue mt-2">
        Details &amp; resources →
      </p>
    </Link>
  );
}
