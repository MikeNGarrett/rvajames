type Status = 'safe' | 'caution' | 'danger' | 'flood' | 'closed';

const styles: Record<Status, { bg: string; text: string; label: string }> = {
  safe:    { bg: 'bg-status-safe',    text: 'text-status-safe-fg',    label: 'Safe' },
  caution: { bg: 'bg-status-caution', text: 'text-status-caution-fg', label: 'Caution' },
  danger:  { bg: 'bg-status-danger',  text: 'text-status-danger-fg',  label: 'High Risk' },
  flood:   { bg: 'bg-status-flood',   text: 'text-status-flood-fg',   label: 'Flood' },
  closed:  { bg: 'bg-status-closed',  text: 'text-status-closed-fg',  label: '🔒 Closed' },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}
