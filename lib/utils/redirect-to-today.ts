/**
 * Shared redirect URL builder for out-of-window date redirects — sub-goal 76.
 *
 * Strips `date` (returning the user to today), preserves all other search
 * params, and appends `notice=<reason>` so DateUnavailableBanner can render.
 *
 * Both the proactive isInWindow guard (checked before the DB query) and the
 * reactive OutOfWindowError catch converge on this helper, ensuring a single
 * source of truth for redirect behaviour.
 *
 * Usage:
 *   import { buildRedirectUrl } from '@/lib/utils/redirect-to-today';
 *   redirect(buildRedirectUrl('/', rawSearchParams));
 *   redirect(buildRedirectUrl(`/locations/${slug}`, rawSearchParams));
 */

export function buildRedirectUrl(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  reason: 'date-unavailable' = 'date-unavailable',
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    // Strip `date` (redirect targets today) and any stale `notice`
    if (key === 'date' || key === 'notice') continue;

    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  params.set('notice', reason);

  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}
