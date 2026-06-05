import { describe, it, expect } from 'vitest';
import { matchLocationKeyword, LOCATION_KEYWORDS } from './keywords';

describe('matchLocationKeyword — shared closure-scraper keyword table', () => {
  describe('Original 10 location slugs (regression coverage)', () => {
    it.each([
      ['Pipeline Trail closed for repairs',           'pipeline-trail'],
      ['Pony Pasture beach reopens Friday',           'pony-pasture'],
      ['Texas Beach access restored',                 'texas-beach'],
      ['Belle Isle pedestrian bridge open',           'belle-isle'],
      ['Browns Island festival postponed',            'browns-island'],
      ['Brown Island festival postponed',             'browns-island'], // single + plural both match
      ['Mayo Island event canceled',                  'mayo-island'],
      ['Shiplock Park improvements complete',         'shiplock-trail'],
      ['Great Shiplock construction next week',       'shiplock-trail'],
      ['North Bank Trail rerouted',                   'north-bank-trail'],
      ['Buttermilk Trail wash-out',                   'buttermilk-trail'],
      ['Pump House Park tours resume',                'pump-house'],
      ['Reedy Creek parking limited',                 'reedy-creek'],
    ])('routes "%s" → %s', (text, expected) => {
      expect(matchLocationKeyword(text)).toBe(expected);
    });
  });

  describe('12 new locations (migration 0017+)', () => {
    it.each([
      ['Canal Walk closed for cleaning',                       'canal-walk'],
      ['Manchester Floodwall Walk lighting upgrade',           'manchester-floodwall-walk'],
      ['Floodwall Park hours change',                          'manchester-floodwall-walk'],
      ['Floodwall Walk repaving',                              'manchester-floodwall-walk'],
      ['Virginia Capital Trail detour at mile 1',              'virginia-capital-trail'],
      ['Capital Trail closure for sewer work',                 'virginia-capital-trail'],
      ['Dock Street Park ribbon cutting',                      'dock-street-park'],
      ['The Wetlands trail reopened',                          'the-wetlands'],
      ['Wetlands trail boardwalk damaged',                     'the-wetlands'],
      ['Ancarrow\'s Landing shad fishing season',              'ancarrows-landing'],
      ['Ancarrows Landing parking lot floods',                 'ancarrows-landing'],
      ['Huguenot Flatwater put-in repaved',                    'huguenot-flatwater'],
      ['Chapel Island footbridge inspection',                  'chapel-island'],
    ])('routes "%s" → %s', (text, expected) => {
      expect(matchLocationKeyword(text)).toBe(expected);
    });
  });

  describe('Tredegar disambiguation', () => {
    it('routes "Tredegar rope swing" mentions to tredegar-rope-swing (specific)', () => {
      expect(matchLocationKeyword('Tredegar rope swing closure after incident')).toBe('tredegar-rope-swing');
      expect(matchLocationKeyword('Rope swing at Tredegar beach removed')).toBe('tredegar-rope-swing');
    });

    it('routes "Tredegar boat ramp" mentions to tredegar-boat-ramp (specific)', () => {
      expect(matchLocationKeyword('Tredegar boat ramp rebuilt 2023')).toBe('tredegar-boat-ramp');
      expect(matchLocationKeyword('Tredegar Street put-in closed')).toBe('tredegar-boat-ramp');
      expect(matchLocationKeyword('Tredegar put-in access closed')).toBe('tredegar-boat-ramp');
    });

    it('routes bare "Tredegar" mentions to tredegar-boat-ramp (canonical river reference)', () => {
      // The fallback ensures we never produce the non-existent 'tredegar' slug
      // that the pre-2026-06-05 table was emitting (which downstream routed
      // to belle-isle via the no-match fallback — silent bug).
      expect(matchLocationKeyword('Tredegar closure announcement')).toBe('tredegar-boat-ramp');
    });
  });

  describe('Manchester disambiguation', () => {
    it('routes "Manchester climbing wall" to manchester-climbing-wall', () => {
      expect(matchLocationKeyword('Manchester climbing wall closure for inspection')).toBe('manchester-climbing-wall');
      expect(matchLocationKeyword('Climbing wall at Manchester floodwall')).toBe('manchester-climbing-wall');
      // "climbing wall" alone should also route here — there's no other
      // climbing-wall location.
      expect(matchLocationKeyword('Climbing wall safety inspection')).toBe('manchester-climbing-wall');
    });

    it('routes "Manchester floodwall walk" (no climbing reference) to manchester-floodwall-walk', () => {
      expect(matchLocationKeyword('Manchester floodwall walk closed for paving')).toBe('manchester-floodwall-walk');
      expect(matchLocationKeyword('Floodwall Park reopens Sunday')).toBe('manchester-floodwall-walk');
    });

    it('climbing-wall pattern wins over floodwall-walk when both could match', () => {
      // A post that mentions BOTH climbing wall AND floodwall must route to
      // climbing-wall (more specific, comes first in the table).
      expect(
        matchLocationKeyword('Climbing wall on Manchester floodwall closed')
      ).toBe('manchester-climbing-wall');
    });
  });

  describe('Park-wide fallback', () => {
    it('routes bare "James River Park" to belle-isle (legacy fallback)', () => {
      expect(matchLocationKeyword('James River Park system-wide alerts')).toBe('belle-isle');
    });
  });

  describe('No match', () => {
    it('returns null for text with no location keyword', () => {
      expect(matchLocationKeyword('General park news with no location')).toBeNull();
      expect(matchLocationKeyword('')).toBeNull();
      expect(matchLocationKeyword('Random text about Richmond weather')).toBeNull();
    });
  });

  describe('Table integrity', () => {
    it('has no entries that produce a slug not present elsewhere in the routing rules', () => {
      // Guards against the pre-2026-06-05 bug where /tredegar/i produced
      // slug:'tredegar' which didn\'t exist in the locations table.
      const VALID_SLUGS = new Set([
        // Original 10
        'pipeline-trail', 'pony-pasture', 'texas-beach', 'belle-isle',
        'browns-island', 'mayo-island', 'shiplock-trail', 'north-bank-trail',
        'buttermilk-trail', 'pump-house',
        // Migration 0017
        'canal-walk', 'manchester-floodwall-walk', 'virginia-capital-trail',
        'dock-street-park', 'reedy-creek', 'the-wetlands',
        'tredegar-boat-ramp', 'ancarrows-landing', 'huguenot-flatwater',
        'tredegar-rope-swing', 'manchester-climbing-wall', 'chapel-island',
      ]);
      for (const { slug } of LOCATION_KEYWORDS) {
        expect(VALID_SLUGS.has(slug), `slug '${slug}' is not in the known set`).toBe(true);
      }
    });
  });
});
