interface Advisory {
  id: string;
  kind: string;
  severity: string;
  headline: string;
  body: string;
}

export function AdvisoriesBanner({ advisories }: { advisories: Advisory[] }) {
  if (!advisories.length) return null;

  const hasHigh = advisories.some((a) => a.severity === 'high' || a.severity === 'extreme');
  const hasFlood = advisories.some((a) => a.kind === 'flood_warning');

  const bannerClass = hasFlood
    ? 'bg-status-flood text-status-flood-fg'
    : hasHigh
    ? 'bg-status-danger text-status-danger-fg'
    : 'bg-status-caution text-status-caution-fg';

  return (
    <div className={`rounded-xl p-4 mb-4 ${bannerClass}`} role="alert">
      <div className="max-w-prose">
        <p className="font-semibold text-base mb-1">
          {advisories.length === 1 ? 'Active Advisory' : `${advisories.length} Active Advisories`}
        </p>
        <ul className="space-y-1">
          {advisories.map((a) => (
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
    </div>
  );
}
