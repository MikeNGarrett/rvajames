import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RiverLevelTile } from './RiverLevelTile';
import type { LocationSummary } from '@/lib/queries/today';

// Reusable LocationSummary factory. Override individual fields per test.
function makeLocation(overrides: Partial<LocationSummary> = {}): LocationSummary {
  return {
    id:             'loc-1',
    slug:           'belle-isle',
    name:           'Belle Isle',
    tags:           ['island'],
    latestGageFt:   3.5,
    latestWaterTempF: 70,
    deterministicStatus: { status: 'safe', label: 'Safe', reason: 'River below typical thresholds' },
    snapshotAge:    300,
    waterQuality:   null,
    upstreamCso:    null,
    activities:     [],
    ...overrides,
  };
}

describe('RiverLevelTile', () => {
  describe('open (status=safe)', () => {
    it('hides the StatusBadge — redundant when nothing is wrong', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({ deterministicStatus: { status: 'safe', label: 'Safe', reason: 'all good' } })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      // StatusBadge for 'safe' would render the label "Safe" — its absence
      // is the signal. We check we don't render the badge wrapper class.
      expect(html).not.toContain('bg-status-safe ');
      expect(html).not.toContain('>Safe<');
    });

    it('still renders the reason text', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'safe', label: 'Safe', reason: 'River below typical thresholds' },
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('River below typical thresholds');
    });

    it('renders LocationStatusRow when water-quality data is present', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            waterQuality: { status: 'safe', ecoliCfuPer100ml: 10 },
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('Water OK');
    });

    it('renders ActivityChipRow with the location\'s verdicts', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            activities: [
              { slug: 'swim', name: 'Swimming', status: 'safe', note: 'all good' },
              { slug: 'hike', name: 'Hiking',  status: 'safe', note: 'all good' },
            ],
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('Swimming');
      expect(html).toContain('Hiking');
    });
  });

  describe('restricted (status=caution)', () => {
    it('shows the StatusBadge', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'caution', label: 'Caution', reason: 'Water temp below 60' },
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('Caution');
    });

    it('renders LocationStatusRow + ActivityChipRow alongside the badge', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'caution', label: 'Caution', reason: 'choppy' },
            waterQuality: { status: 'safe', ecoliCfuPer100ml: 10 },
            activities: [{ slug: 'swim', name: 'Swimming', status: 'caution', note: 'cold' }],
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('Water OK');
      expect(html).toContain('Swimming');
    });
  });

  describe('high-risk (status=danger)', () => {
    it('shows StatusBadge + rows', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'danger', label: 'High Risk', reason: 'Gauge 12.5 ft' },
            activities: [{ slug: 'swim', name: 'Swimming', status: 'deny', note: 'high flow' }],
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('High Risk');
      expect(html).toContain('Swimming');
    });
  });

  describe('closed (status=closed)', () => {
    it('shows the StatusBadge', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'closed', label: 'Closed', reason: 'Maintenance — closed through Oct 2026' },
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      // StatusBadge for 'closed' renders 🔒 Closed
      expect(html).toContain('Closed');
    });

    it('renders the closure reason text', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'closed', label: 'Closed', reason: 'Maintenance — closed through Oct 2026' },
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      expect(html).toContain('Maintenance — closed through Oct 2026');
    });

    it('does NOT render LocationStatusRow even when env data is present', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'closed', label: 'Closed', reason: 'Park closure' },
            waterQuality: { status: 'safe', ecoliCfuPer100ml: 10 },
            upstreamCso: { count: 0, mostRecentAt: null, outfalls: [] },
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      // Closed → environmental indicators suppressed
      expect(html).not.toContain('Water OK');
      expect(html).not.toContain('No overflows upstream');
    });

    it('does NOT render ActivityChipRow even when activities are populated', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({
            deterministicStatus: { status: 'closed', label: 'Closed', reason: 'Park closure' },
            activities: [
              { slug: 'hike', name: 'Hiking', status: 'safe', note: 'all good' },
              { slug: 'fish', name: 'Fishing', status: 'safe', note: 'all good' },
            ],
          })}
          dateStr="2026-06-04"
          ageBucket="6-9"
        />,
      );
      // Closed → activity chips suppressed
      expect(html).not.toContain('Hiking');
      expect(html).not.toContain('Fishing');
    });
  });

  describe('navigation href', () => {
    it('preserves date + age in the link target', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({ slug: 'pony-pasture' })}
          dateStr="2026-06-04"
          ageBucket="10-13"
        />,
      );
      expect(html).toContain('/locations/pony-pasture?date=2026-06-04&amp;age=10-13');
    });

    it('URL-encodes the "+" in the 14+ bucket', () => {
      const html = renderToStaticMarkup(
        <RiverLevelTile
          location={makeLocation({ slug: 'belle-isle' })}
          dateStr="2026-06-04"
          ageBucket="14+"
        />,
      );
      expect(html).toContain('age=14%2B');
    });
  });
});
