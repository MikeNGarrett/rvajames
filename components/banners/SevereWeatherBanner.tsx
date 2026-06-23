import type { SevereWeatherResult } from '@/lib/safety/rules';

/**
 * Severe-weather alert (NWS watches/warnings), driven by the deterministic
 * severeWeatherStatus gate — NOT the AI — so it shows even when the lazy
 * summary fails to load.
 *
 * Layout is identical to CsoBanner (page-width container matching
 * PageContainer, left-aligned copy, justify-between microcopy row) so the
 * alert area reads as one system. NOT sticky itself — <AlertStack> owns
 * stacking + ordering so multiple banners never overlap.
 *
 * Colors match CsoBanner's severity tokens:
 *   warning → danger (red),  role="alert"
 *   watch   → caution (amber), role="status"
 */
export function SevereWeatherBanner({ result }: { result: SevereWeatherResult }) {
  if (result.tier === 'none') return null;

  const isWarning = result.tier === 'warning';
  const colorClasses = isWarning
    ? 'bg-status-danger text-status-danger-fg'
    : 'bg-status-caution text-status-caution-fg';

  return (
    <div className={`${colorClasses} text-sm`} role={isWarning ? 'alert' : 'status'}>
      <div className="max-w-lg sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 py-3">
        <p className="font-semibold leading-snug">{result.message}</p>

        <div className="flex items-center justify-between gap-3 mt-1.5 flex-wrap">
          <span className="text-xs">{result.headlines.slice(0, 2).join(' · ')}</span>
          <a
            href="https://www.weather.gov/akq/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline underline-offset-2 touch-target inline-flex items-center flex-shrink-0"
          >
            Check NWS Wakefield &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
