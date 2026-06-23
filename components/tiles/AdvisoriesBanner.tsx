interface Advisory {
  id: string;
  kind: string;
  severity: string;
  headline: string;
  body: string;
}

/**
 * Advisory kinds that have a DEDICATED top-of-page banner (AlertStack):
 * CSO overflows (CsoBanner) and severe weather — any flood alert, or a
 * high/extreme-severity NWS "general" alert (severe thunderstorm / tornado),
 * which severeWeatherStatus surfaces in SevereWeatherBanner. Excluding these
 * here prevents showing the same alert twice. This banner is the catch-all for
 * advisory types WITHOUT a dedicated banner (e.g. bacterial water quality).
 */
function coveredByDedicatedBanner(a: Advisory): boolean {
  return (
    a.kind === 'cso_overflow' ||
    a.kind === 'flood_watch' ||
    a.kind === 'flood_warning' ||
    a.kind === 'flood_advisory' ||
    (a.kind === 'general' && (a.severity === 'high' || a.severity === 'extreme'))
  );
}

export function AdvisoriesBanner({ advisories }: { advisories: Advisory[] }) {
  const shown = advisories.filter((a) => !coveredByDedicatedBanner(a));
  if (!shown.length) return null;

  const hasHigh = shown.some((a) => a.severity === 'high' || a.severity === 'extreme');
  const bannerClass = hasHigh
    ? 'bg-status-danger text-status-danger-fg'
    : 'bg-status-caution text-status-caution-fg';

  return (
    <div className={`rounded-xl p-4 mb-4 ${bannerClass}`} role="alert">
      <p className="font-semibold text-base mb-1">
        {shown.length === 1 ? 'Active Advisory' : `${shown.length} Active Advisories`}
      </p>
      <ul className="space-y-1">
        {/* One row per advisory type without a dedicated banner. */}
        {shown.map((a) => (
          <li key={a.id} className="text-sm">
            {a.body ? (
              /*
               * Native <details>/<summary> — universally supported, no JS
               * required, keyboard-accessible by default, screen readers
               * announce expand/collapse state. The custom triangle is
               * rotated via `group-open:` so we can remove the default
               * webkit/blink disclosure marker via list-none.
               */
              <details className="group">
                <summary
                  className="flex items-start gap-2 cursor-pointer list-none -mx-1 px-1 py-2 min-h-[44px] rounded hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 text-[10px] opacity-70 transition-transform group-open:rotate-90"
                  >
                    ▶
                  </span>
                  <span className="flex-1">{a.headline}</span>
                </summary>
                <div className="mt-2 pl-5 pr-2 text-xs leading-relaxed whitespace-pre-line opacity-95">
                  {a.body}
                </div>
              </details>
            ) : (
              <div className="px-1 py-1">{a.headline}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
