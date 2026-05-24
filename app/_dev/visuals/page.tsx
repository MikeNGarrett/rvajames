/**
 * /_dev/visuals — sub-goal 36 dev showcase.
 * Gated to NODE_ENV !== 'production'. If hit in prod this 404s.
 * Use to visually verify HorizontalGauge, Sparkline, and TrendArrow.
 */

import { notFound } from 'next/navigation';
import { HorizontalGauge } from '@/components/ui/HorizontalGauge';
import { Sparkline } from '@/components/ui/Sparkline';
import { TrendArrow } from '@/components/ui/TrendArrow';

export default function VisualsDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  // Sample 72h of gage data
  const now = Date.now();
  const sparkPoints = Array.from({ length: 72 }, (_, i) => ({
    t: now - (71 - i) * 3_600_000,
    v: 3.2 + Math.sin(i / 8) * 0.6 + i * 0.01,
  }));

  return (
    <main className="max-w-lg mx-auto p-6 space-y-10">
      <h1 className="text-xl font-bold text-text">Visual Primitives — Dev Showcase</h1>

      {/* ─── HorizontalGauge ─── */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          HorizontalGauge
        </h2>
        <div className="space-y-6">
          {/* Normal range */}
          <div>
            <p className="text-xs text-text-muted mb-1">Normal flow (3.69 ft, bands at 2–4 ft)</p>
            <HorizontalGauge
              value={3.69}
              min={0}
              max={12}
              normalBand={{ low: 2.0, high: 4.0 }}
              ariaLabel="River level 3.69 feet — normal range"
              bandLabels={[
                { value: 0,    label: 'Low' },
                { value: 4.0,  label: 'Elev' },
                { value: 8.0,  label: 'High' },
                { value: 12,   label: 'Flood' },
              ]}
            />
          </div>

          {/* Elevated with critical band */}
          <div>
            <p className="text-xs text-text-muted mb-1">Elevated (6.5 ft, critical band 8–12)</p>
            <HorizontalGauge
              value={6.5}
              min={0}
              max={12}
              normalBand={{ low: 2.0, high: 4.0 }}
              criticalBand={{ low: 8.0, high: 12 }}
              ariaLabel="River level 6.5 feet — elevated"
              bandLabels={[
                { value: 0,   label: 'Low' },
                { value: 4.0, label: 'Elev' },
                { value: 8.0, label: 'High' },
                { value: 12,  label: 'Flood' },
              ]}
            />
          </div>

          {/* Flood stage */}
          <div>
            <p className="text-xs text-text-muted mb-1">Flood (10.5 ft)</p>
            <HorizontalGauge
              value={10.5}
              min={0}
              max={12}
              normalBand={{ low: 2.0, high: 4.0 }}
              criticalBand={{ low: 8.0, high: 12 }}
              ariaLabel="River level 10.5 feet — flood stage"
            />
          </div>
        </div>
      </section>

      {/* ─── Sparkline ─── */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Sparkline (72h)
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-text-muted mb-1">With normal band (p25=2.8, p75=4.2)</p>
            <div className="border border-border rounded-lg p-2">
              <Sparkline
                points={sparkPoints}
                normalBand={{ low: 2.8, high: 4.2 }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Without normal band</p>
            <div className="border border-border rounded-lg p-2">
              <Sparkline points={sparkPoints} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── TrendArrow ─── */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          TrendArrow
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted w-32">Rising (safety)</span>
            <TrendArrow currentValue={3.9} valueOneHourAgo={3.7} unit="ft" semantics="safety" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted w-32">Falling (safety)</span>
            <TrendArrow currentValue={3.5} valueOneHourAgo={3.9} unit="ft" semantics="safety" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted w-32">Steady</span>
            <TrendArrow currentValue={3.7} valueOneHourAgo={3.7} unit="ft" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted w-32">No prior data</span>
            <TrendArrow currentValue={3.7} valueOneHourAgo={null} unit="ft" />
          </div>
        </div>
      </section>
    </main>
  );
}
