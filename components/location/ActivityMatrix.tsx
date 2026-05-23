const ACTIVITY_NAMES: Record<string, string> = {
  'swim': 'Swimming',
  'kayak-rapids': 'Kayaking',
  'rock-hop': 'Rock-Hopping',
  'bridge-crossing': 'Potterfield Bridge',
  'belle-isle-pedestrian': 'Belle Isle Bridge',
  'beach-access': 'Beach Access',
  'hike': 'Hiking',
};

interface ActivityResult {
  slug: string;
  status: 'safe' | 'caution' | 'deny';
  note: string;
}

const statusStyles = {
  safe:    { dot: 'bg-status-safe', text: 'text-status-safe-fg', label: '✓' },
  caution: { dot: 'bg-status-caution', text: 'text-status-caution-fg', label: '!' },
  deny:    { dot: 'bg-status-danger', text: 'text-status-danger-fg', label: '✗' },
};

export function ActivityMatrix({ activities }: { activities: ActivityResult[] }) {
  if (!activities.length) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-base font-semibold text-text">Activities today</h3>
      </div>
      <ul>
        {activities.map((act, i) => {
          const style = statusStyles[act.status];
          return (
            <li
              key={act.slug}
              className={`flex items-center gap-3 px-4 py-3 ${i < activities.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${style.dot} ${style.text}`}
                aria-label={act.status}
              >
                {style.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">
                  {ACTIVITY_NAMES[act.slug] ?? act.slug}
                </p>
                <p className="text-xs text-text-muted leading-snug">{act.note}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
