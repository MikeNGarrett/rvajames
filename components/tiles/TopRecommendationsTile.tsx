import Link from 'next/link';
import type { LocationSummary } from '@/lib/queries/today';

export function TopRecommendationsTile({ locations }: { locations: LocationSummary[] }) {
  const top = locations
    .filter((l) => l.deterministicStatus.status === 'safe')
    .slice(0, 3);

  if (!top.length) return null;

  return (
    <section className="rounded-xl bg-status-safe-subtle border border-status-safe p-4 mb-4">
      <h2 className="text-lg font-semibold text-text mb-3">Best bets today</h2>
      <ul className="space-y-2">
        {top.map((loc) => (
          <li key={loc.id}>
            <Link
              href={`/locations/${loc.slug}`}
              className="flex items-center justify-between gap-2 touch-target"
            >
              <div>
                <span className="font-medium text-rva-blue">{loc.name}</span>
                <p className="text-sm text-text-secondary">{loc.deterministicStatus.reason}</p>
              </div>
              <span className="text-rva-blue text-lg" aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
