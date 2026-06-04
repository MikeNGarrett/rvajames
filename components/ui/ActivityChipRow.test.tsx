import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityChipRow, type ActivityChip } from './ActivityChipRow';

const chip = (
  slug: string,
  name: string,
  status: ActivityChip['status'],
  note?: string,
): ActivityChip => ({ slug, name, status, note });

describe('ActivityChipRow', () => {
  it('returns null when the activities list is empty', () => {
    const html = renderToStaticMarkup(<ActivityChipRow activities={[]} />);
    expect(html).toBe('');
  });

  it('renders all chips when count ≤ max (default 3)', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('swim', 'Swimming', 'safe'),
          chip('hike', 'Hiking', 'safe'),
        ]}
      />,
    );
    expect(html).toContain('Swimming');
    expect(html).toContain('Hiking');
    expect(html).not.toContain('+');
  });

  it('caps visible chips at max=3 and renders "+N more" indicator', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('a', 'Wading', 'safe'),
          chip('b', 'Swimming', 'safe'),
          chip('c', 'Rock-Hopping', 'safe'),
          chip('d', 'Hiking', 'safe'),
          chip('e', 'Fishing', 'safe'),
        ]}
      />,
    );
    expect(html).toContain('Wading');
    expect(html).toContain('Swimming');
    expect(html).toContain('Rock-Hopping');
    expect(html).not.toContain('Hiking');
    expect(html).not.toContain('Fishing');
    expect(html).toContain('+2 more');
  });

  it('uses "+N more" singular form when overflow is 1', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('a', 'A', 'safe'),
          chip('b', 'B', 'safe'),
          chip('c', 'C', 'safe'),
          chip('d', 'D', 'safe'),
        ]}
      />,
    );
    expect(html).toContain('+1 more');
    // The aria-label should singular-correct too
    expect(html).toMatch(/aria-label="[^"]*1 more activity/);
  });

  it('sorts worst-first: deny before caution before safe', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('a', 'Hike', 'safe'),
          chip('b', 'Swim', 'deny'),
          chip('c', 'Wade', 'caution'),
        ]}
      />,
    );
    // Find the index of each name in the rendered HTML — deny should
    // appear first (smallest index), safe last.
    const denyIdx    = html.indexOf('Swim');
    const cautionIdx = html.indexOf('Wade');
    const safeIdx    = html.indexOf('Hike');
    expect(denyIdx).toBeLessThan(cautionIdx);
    expect(cautionIdx).toBeLessThan(safeIdx);
  });

  it('hides safe activities first when overflow trims the list (worst-first sort means safe falls off)', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('a', 'Fishing', 'safe'),
          chip('b', 'Swim', 'deny'),
          chip('c', 'Wade', 'caution'),
          chip('d', 'Hike', 'safe'),
          chip('e', 'Picnic', 'safe'),
        ]}
      />,
    );
    // deny + caution + 1 of the safes survive; 2 safes get hidden
    expect(html).toContain('Swim');
    expect(html).toContain('Wade');
    expect(html).toContain('+2 more');
    // One of the safes still renders (whichever was first in stable order)
    expect(html).toContain('Fishing');
  });

  it('renders each chip with aria-label combining activity name + status', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('swim', 'Swimming', 'deny'),
          chip('hike', 'Hiking', 'safe'),
        ]}
      />,
    );
    expect(html).toContain('aria-label="Swimming: not allowed"');
    expect(html).toContain('aria-label="Hiking: OK"');
  });

  it('uses the activity note as the title attribute when present', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[
          chip('swim', 'Swimming', 'caution', 'Water temp below 60°F'),
        ]}
      />,
    );
    expect(html).toContain('title="Water temp below 60°F"');
  });

  it('falls back to a generated title when no note is provided', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[chip('hike', 'Hiking', 'safe')]}
      />,
    );
    expect(html).toContain('title="Hiking: OK"');
  });

  it('uses <ul role="list"> + <li> children for AT enumeration', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        activities={[chip('swim', 'Swimming', 'safe')]}
      />,
    );
    expect(html).toMatch(/<ul[^>]+role="list"/);
    expect(html).toMatch(/<li/);
  });

  it('honors a custom max', () => {
    const html = renderToStaticMarkup(
      <ActivityChipRow
        max={1}
        activities={[
          chip('a', 'A', 'safe'),
          chip('b', 'B', 'safe'),
          chip('c', 'C', 'safe'),
        ]}
      />,
    );
    expect(html).toContain('A');
    expect(html).not.toContain('>B<');
    expect(html).not.toContain('>C<');
    expect(html).toContain('+2 more');
  });
});
