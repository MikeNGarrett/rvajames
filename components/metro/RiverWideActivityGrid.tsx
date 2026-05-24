/**
 * River-wide activity status grid — sub-goal 33.
 * Shows 4 activities (swimming, rock-hopping, kayaking, hiking) in a
 * 2×2 mobile / 4×1 desktop layout with status pills and AI-written notes.
 * Statuses come from the deterministic rules engine (AI only writes the note).
 */

import type { MetroSummary } from '@/lib/ai/prompts/summarize-metro';

type Activity = NonNullable<MetroSummary['activities']>[number];

interface Props {
  activities: NonNullable<MetroSummary['activities']>;
}

const ACTIVITY_META: Record<string, { label: string; icon: string }> = {
  'swimming':            { label: 'Swimming',            icon: '🏊' },
  'rock-hopping':        { label: 'Rock Hopping',        icon: '🪨' },
  'kayaking-whitewater': { label: 'Whitewater Kayaking', icon: '🛶' },
  'hiking':              { label: 'Hiking',              icon: '🥾' },
};

const STATUS_STYLES: Record<Activity['status'], { badge: string; label: string }> = {
  safe:    { badge: 'bg-status-safe text-status-safe-fg',       label: 'Go' },
  caution: { badge: 'bg-status-caution text-status-caution-fg', label: 'Caution' },
  deny:    { badge: 'bg-status-danger text-status-danger-fg',   label: 'No Go' },
};

export function RiverWideActivityGrid({ activities }: Props) {
  return (
    /* @container on the wrapper; grid queries the container width, not the viewport.
       This makes the grid relocatable — it works in any context (sidebar, narrow column, etc.)
       and correctly responds to the wider page layout introduced by sub-goal 48.
       guide: size-aware-styling, fluid-scaling (Finding 23) */
    <div className="@container mb-3">
    <div
      className="grid grid-cols-2 @md:grid-cols-4 gap-2"
      aria-label="River-wide activity status"
    >
      {activities.map((activity) => {
        const meta   = ACTIVITY_META[activity.slug] ?? { label: activity.slug, icon: '•' };
        const styles = STATUS_STYLES[activity.status];

        return (
          <div
            key={activity.slug}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3 min-h-[44px]"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-base leading-none" aria-hidden>
                {meta.icon}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${styles.badge}`}
              >
                {styles.label}
              </span>
            </div>
            <p className="text-xs font-medium text-text leading-tight">{meta.label}</p>
            <p className="text-xs text-text-muted leading-snug">{activity.note}</p>
          </div>
        );
      })}
    </div>
    </div>
  );
}
