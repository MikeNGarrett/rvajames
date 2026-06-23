import type { ReactNode } from 'react';
import type { SevereWeatherResult } from '@/lib/safety/rules';
import type { TodayData } from '@/lib/queries/today';
import type { AgeBucket } from '@/lib/url-state';
import { SevereWeatherBanner } from './SevereWeatherBanner';
import { CsoBanner, csoBannerTone } from './CsoBanner';

interface Props {
  severeWeather: SevereWeatherResult;
  /** CSO state — omit on pages that don't surface the CSO banner. */
  cso?: TodayData['cso'];
  ageBucket?: AgeBucket;
  mode?: 'observed' | 'forecast';
}

/**
 * The single sticky container for top-of-page alert banners. Owns stacking +
 * ordering so the banners can't overlap (a prior bug: two independently
 * `sticky top-0` banners collided on scroll) and so the severity reads
 * correctly:
 *   • danger (red) above caution (amber) — active hazard over potential one
 *   • within a tone, severe weather before CSO (life-safety tiebreak)
 *
 * Each banner component is style-only and non-sticky; this is the one place
 * that decides order + stickiness, shared by the homepage and location pages.
 */
export function AlertStack({ severeWeather, cso, ageBucket, mode }: Props) {
  const entries: { tone: 'danger' | 'caution'; kindRank: number; key: string; node: ReactNode }[] = [];

  if (severeWeather.tier !== 'none') {
    entries.push({
      tone: severeWeather.tier === 'warning' ? 'danger' : 'caution',
      kindRank: 0, // weather wins ties
      key: 'weather',
      node: <SevereWeatherBanner result={severeWeather} />,
    });
  }

  if (cso && ageBucket && mode) {
    const tone = csoBannerTone(cso, mode);
    if (tone) {
      entries.push({
        tone,
        kindRank: 1,
        key: 'cso',
        node: <CsoBanner cso={cso} ageBucket={ageBucket} mode={mode} />,
      });
    }
  }

  if (entries.length === 0) return null;

  const toneRank = (t: 'danger' | 'caution') => (t === 'danger' ? 0 : 1);
  entries.sort((a, b) => toneRank(a.tone) - toneRank(b.tone) || a.kindRank - b.kindRank);

  return (
    <div className="sticky top-0 z-40">
      {entries.map((e) => (
        <div key={e.key}>{e.node}</div>
      ))}
    </div>
  );
}
