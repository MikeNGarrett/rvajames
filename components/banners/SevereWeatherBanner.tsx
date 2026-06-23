import type { SevereWeatherResult } from '@/lib/safety/rules';

/**
 * Top-of-page severe-weather alert. Driven by the deterministic
 * `severeWeatherStatus` gate (NWS watches/warnings), NOT by the AI — so the
 * "not safe today" signal shows even when the lazy AI summary fails to load.
 *
 * Sticky positioning, z-index, and color tokens match CsoBanner/the former
 * FloodBanner. A `warning` (imminent) renders in the strongest flood styling;
 * a `watch` (conditions favorable) renders in caution styling.
 */
export function SevereWeatherBanner({ result }: { result: SevereWeatherResult }) {
  if (result.tier === 'none') return null;

  const isWarning = result.tier === 'warning';
  const colorClass = isWarning
    ? 'bg-status-flood text-status-flood-fg'
    : 'bg-status-caution text-status-caution-fg';

  return (
    <div
      className={`sticky top-0 z-40 ${colorClass} text-sm text-center py-3 px-4`}
      role="alert"
    >
      <div className="inline-block max-w-prose">
        <p className="font-semibold">{result.message}</p>
        {result.headlines.length > 0 && (
          <p className="mt-1 text-xs font-medium opacity-90">
            {result.headlines.slice(0, 3).join(' · ')}
          </p>
        )}
        <p className="mt-1 text-xs">
          Check{' '}
          <a
            href="https://www.weather.gov/akq/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            NWS Wakefield
          </a>{' '}
          for current conditions.
        </p>
      </div>
    </div>
  );
}
