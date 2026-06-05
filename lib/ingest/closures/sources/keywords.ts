/**
 * Shared location-keyword table for the closure scrapers
 * (jrps.ts, rva-gov.ts, venture-richmond.ts).
 *
 * Each scraper used to maintain its own near-identical copy of this list.
 * Extracted 2026-06-05 so adding a new location is a one-place change and
 * the three scrapers can't drift.
 *
 * ── Disambiguation order ──────────────────────────────────────────────────
 * Pattern matching is first-match-wins. The table is ordered MOST SPECIFIC
 * FIRST so multi-word patterns win over single-keyword ones that contain
 * them as substrings.
 *
 *   1. Specific multi-word patterns first (e.g. "tredegar rope swing" before
 *      bare "tredegar"; "manchester climbing wall" before bare "manchester")
 *   2. Single-keyword patterns (one canonical name per slug)
 *   3. Park-wide / generic fallbacks last (where appropriate)
 *
 * ── Tredegar disambiguation ───────────────────────────────────────────────
 * The site has TWO distinct river-adjacent locations sharing the "Tredegar"
 * name:
 *   - tredegar-boat-ramp     (the JRPS-sanctioned put-in/take-out)
 *   - tredegar-rope-swing    (the informal eddy below the CSX trestle)
 * Plus a non-river-recreation reference (Tredegar Iron Works museum).
 *
 * The patterns route specific mentions ("Tredegar rope swing", "Tredegar
 * boat ramp") correctly, and the BARE "Tredegar" fallback routes to
 * `tredegar-boat-ramp` since that's the canonical river-access reference.
 *
 * Pre-2026-06-05 history: the table mapped /tredegar/i to a slug 'tredegar'
 * which DID NOT EXIST in the locations table. Downstream this would fall
 * back to belle-isle (the default-fallback target), meaning every Tredegar
 * mention was being tagged as a Belle Isle closure. Fixed in this refactor.
 *
 * ── Park-wide fallback ────────────────────────────────────────────────────
 * The `/james\s+river\s+park/i` pattern still falls back to `belle-isle`
 * (matches the pre-2026-06-05 behavior). That's a sloppy choice — a
 * better posture would be a "park-wide" virtual slug or null. Deferred
 * to a future round since it's a behavior change not just a refactor.
 */

export interface LocationKeyword {
  pattern: RegExp;
  slug: string;
}

export const LOCATION_KEYWORDS: ReadonlyArray<LocationKeyword> = [
  // ── Tier 1: SPECIFIC multi-word disambiguators (must come first) ─────────

  // Tredegar rope swing — informal site. Must match before bare "tredegar"
  // so a closure announcement about the rope swing routes to the right card.
  { pattern: /tredegar.*(rope|swing)|(rope|swing).*tredegar/i, slug: 'tredegar-rope-swing' },

  // Manchester Climbing Wall — must match before "floodwall" since the
  // wall is at the south end of the floodwall area, and a post saying
  // "Manchester climbing wall closure" should NOT be routed to the walk.
  { pattern: /manchester\s+(climbing|rock|wall)|climbing\s+wall/i, slug: 'manchester-climbing-wall' },

  // Manchester Floodwall Walk / Floodwall Park — explicitly the pedestrian
  // walk on top of the floodwall. Must match before bare "manchester".
  { pattern: /manchester\s+floodwall|floodwall\s+(park|walk)/i, slug: 'manchester-floodwall-walk' },

  // Tredegar Boat Ramp / Tredegar Street Put-in — explicit boat-ramp
  // mentions. Must match before bare "tredegar".
  { pattern: /tredegar.*(boat|ramp|put.in|take.out|launch|put|street)/i, slug: 'tredegar-boat-ramp' },

  // Virginia Capital Trail — Richmond terminus
  { pattern: /(virginia\s+capital\s+trail|capital\s+trail)/i, slug: 'virginia-capital-trail' },

  // ── Tier 2: single-keyword patterns (one canonical name per slug) ────────

  // Original 10 locations (pre-2026-06-05)
  { pattern: /pipeline\s+trail/i,       slug: 'pipeline-trail'   },
  { pattern: /pony\s+pasture/i,         slug: 'pony-pasture'     },
  { pattern: /texas\s+beach/i,          slug: 'texas-beach'      },
  { pattern: /belle\s+isle/i,           slug: 'belle-isle'       },
  { pattern: /browns?\s+island/i,       slug: 'browns-island'    },
  { pattern: /mayo\s+island/i,          slug: 'mayo-island'      },
  { pattern: /shiplock/i,               slug: 'shiplock-trail'   },
  { pattern: /north\s+bank/i,           slug: 'north-bank-trail' },
  { pattern: /buttermilk/i,             slug: 'buttermilk-trail' },
  { pattern: /pump\s+house/i,           slug: 'pump-house'       },
  { pattern: /reedy\s+creek/i,          slug: 'reedy-creek'      },

  // 12 new locations (migration 0017, added 2026-06-05)
  { pattern: /canal\s+walk/i,           slug: 'canal-walk'       },
  { pattern: /dock\s+street/i,          slug: 'dock-street-park' },
  { pattern: /(the\s+wetlands|wetlands\s+trail)/i, slug: 'the-wetlands' },
  { pattern: /ancarrow/i,               slug: 'ancarrows-landing' },
  { pattern: /huguenot/i,               slug: 'huguenot-flatwater' },
  { pattern: /chapel\s+island/i,        slug: 'chapel-island'    },

  // ── Tier 3: bare-keyword fallbacks ───────────────────────────────────────

  // Bare "tredegar" — falls back to the boat ramp as the canonical river
  // reference. Caveat: also matches "Tredegar Iron Works" museum mentions,
  // which would tag those as boat-ramp closures. Acceptable tradeoff
  // because the museum doesn't issue closure announcements through these
  // sources (JRPS, RVA.gov, Venture Richmond all cover river infrastructure,
  // not museum hours).
  { pattern: /tredegar/i,               slug: 'tredegar-boat-ramp' },

  // James River Park (park-wide) — falls back to belle-isle as the marquee
  // park entity. See file header for why this is sketchy and deferred.
  { pattern: /james\s+river\s+park/i,   slug: 'belle-isle'       },
];

/**
 * Returns the first slug whose pattern matches `text`, or null if none match.
 * Used by all three closure scrapers.
 */
export function matchLocationKeyword(text: string): string | null {
  for (const { pattern, slug } of LOCATION_KEYWORDS) {
    if (pattern.test(text)) return slug;
  }
  return null;
}
