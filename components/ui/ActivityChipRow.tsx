/**
 * ActivityChipRow — horizontal row of per-activity status chips for a
 * JRPS access point. Designed for the redesigned RiverLevelTile (tile
 * redesign round, 2026-06-04+).
 *
 * Each chip is a small pill showing:
 *   - Status symbol (✓ safe / ⚠ caution / ✗ deny)
 *   - Activity name (truncated by container width on narrow screens)
 *   - Status-based background color
 *
 * Layout decisions (from 2026-06-03 design discussion)
 *   - Cap at 3 visible chips ("cap at 3 in case some are longer
 *     descriptions, e.g. white water rafting"). Overflow rendered as
 *     "+N more" so the user knows there are additional activities at
 *     this location not shown.
 *   - Sort order: deny first, caution next, safe last. Surfaces
 *     warnings on first scan. Within the same status, callers control
 *     the original order (stable sort).
 *
 * Accessibility
 *   - <ul role="list"> wrapper + <li> children so screen readers
 *     announce "list of N items".
 *   - Each chip has an aria-label combining activity name + status.
 *   - title attribute carries the optional `note` (deterministic
 *     reason string from the rules engine) as a tooltip when present.
 *
 * Caller is responsible for filtering activities by age bucket and
 * intersecting with the location's seeded activities (location_activities
 * join). This component is purely presentational.
 */

export interface ActivityChip {
  /** Activity slug — used as the React key. */
  slug:   string;
  /** Human-readable name (e.g. "Swimming", "Rock-Hopping"). */
  name:   string;
  /** Deterministic verdict from the rules engine. */
  status: 'safe' | 'caution' | 'deny';
  /**
   * Optional short reason string from the rules engine. Surfaced via
   * the chip's title attribute (tooltip) — not displayed as visible
   * text since the chip should stay compact.
   */
  note?:  string;
}

interface Props {
  activities: ActivityChip[];
  /**
   * Max chips to render. Default 3. Anything beyond renders as a
   * "+N more" overflow indicator.
   */
  max?: number;
}

/** Worst-first sort key. Lower number = render first. */
const STATUS_PRIORITY: Record<ActivityChip['status'], number> = {
  deny:    0,
  caution: 1,
  safe:    2,
};

const STATUS_VISUAL: Record<ActivityChip['status'], {
  symbol: string;
  className: string;
  ariaState: string;
}> = {
  safe: {
    symbol:    '✓',
    className: 'bg-status-safe-subtle text-status-safe-fg',
    ariaState: 'OK',
  },
  caution: {
    symbol:    '⚠',
    className: 'bg-status-caution-subtle text-status-caution-fg',
    ariaState: 'caution',
  },
  deny: {
    symbol:    '✗',
    // Solid danger (not -subtle) so the deny pill's background is distinct from
    // the danger card it sits on (bg-status-danger-subtle) — otherwise the pill
    // is invisible against the card and the white text has no contrast.
    className: 'bg-status-danger text-status-danger-fg',
    ariaState: 'not allowed',
  },
};

export function ActivityChipRow({ activities, max = 3 }: Props) {
  if (activities.length === 0) return null;

  // Stable worst-first sort — Array.prototype.sort is required to be
  // stable in modern engines (V8 since Node 10, all Workers runtimes).
  const sorted   = [...activities].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
  );
  const visible  = sorted.slice(0, max);
  const overflow = sorted.length - visible.length;

  return (
    <ul role="list" className="flex flex-wrap items-center gap-1.5">
      {visible.map((a) => (
        <li key={a.slug}>
          <ActivityChipItem activity={a} />
        </li>
      ))}
      {overflow > 0 && (
        <li
          className="text-xs text-text-secondary"
          aria-label={`Plus ${overflow} more activit${overflow !== 1 ? 'ies' : 'y'} at this location`}
        >
          +{overflow} more
        </li>
      )}
    </ul>
  );
}

function ActivityChipItem({ activity }: { activity: ActivityChip }) {
  const v = STATUS_VISUAL[activity.status];
  return (
    <span
      aria-label={`${activity.name}: ${v.ariaState}`}
      title={activity.note ?? `${activity.name}: ${v.ariaState}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${v.className}`}
    >
      <span aria-hidden="true">{v.symbol}</span>
      <span>{activity.name}</span>
    </span>
  );
}
