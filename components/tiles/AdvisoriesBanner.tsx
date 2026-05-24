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
              {a.headline}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
