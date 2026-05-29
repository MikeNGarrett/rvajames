/**
 * EmNet CSO ingest — Cloudflare Browser Rendering
 *
 * Fetches Richmond DPU combined sewer overflow data from the public EmNet map
 * (apps.emnet.net/richmond-pub-map-app) via headless browser.
 *
 * The EmNet map at apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-...
 * is the authoritative source for CSO monitoring and modeled sites since DPU
 * retired its rva.gov advisory pages in 2026.
 *
 * ── Extraction strategy ───────────────────────────────────────────────────────
 *
 * Primary: Network response interception.
 *   The React app fetches a JSON array of site objects on load. We set up a
 *   response listener before navigating and capture the first response that
 *   looks like site data. This approach gets raw server data, unaffected by
 *   any React rendering issues.
 *
 * Fallback: React fiber traversal (page.evaluate).
 *   If no matching network response was captured (e.g. the response body was
 *   already consumed by CDP, or the app cached the data), we traverse the
 *   React fiber tree attached to #root to find the component state array that
 *   holds the site list.
 *
 * ── Data structure confirmed via bundle analysis ──────────────────────────────
 *
 *   n[t].id                                         — emnet site UUID
 *   n[t].site_config.name                           — display name
 *   n[t].site_config.site_type                      — 'monitored' | 'modeled'
 *   n[t].site_config.bodies                         — affected water body names
 *   n[t].lat, n[t].lon                              — WGS84 coordinates
 *   n[t].analysis_results.overflow                  — current overflow state
 *   n[t].analysis_results.analysis_results.cso_last_occurrence  — DOUBLE NESTED
 *
 * The outer `analysis_results` is the API response wrapper; the inner
 * `analysis_results` is the actual results blob.
 */

import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';

export const EMNET_URL =
  'https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9';

/** Water body name patterns that indicate James River mainstem (case-insensitive) */
const JAMES_MAINSTEM_PATTERNS = ['james river', 'james'];

// ── Public types ──────────────────────────────────────────────────────────────

/** Normalized site — the shape returned by fetchEmnetSites() */
export interface EmNetSite {
  emnetId: string;
  name: string;
  lat: number;
  lng: number;
  bodies: string[];
  siteType: string;
  affectsJamesMainstem: boolean;
  csoLastOccurrence: string | null;
  overflow: boolean | null;
}

// ── Pure helper functions (exported for unit tests) ───────────────────────────

/**
 * Returns true if any body name contains a James River mainstem reference.
 * Case-insensitive substring match so "James River Mainstem", "james river",
 * and bare "James" all match.
 */
export function isJamesMainstem(bodies: string[]): boolean {
  return bodies.some((b) =>
    JAMES_MAINSTEM_PATTERNS.some((p) => b.toLowerCase().includes(p)),
  );
}

/**
 * Deterministic source_id for an EmNet CSO advisory.
 * Format: "{emnetId}:{csoLastOccurrence}" — unique per site per discharge event.
 * Re-running the same ingest with the same data produces the same id,
 * so upsert on (source, source_id) is always a no-op until a new event.
 */
export function buildSourceId(emnetId: string, csoLastOccurrence: string): string {
  return `${emnetId}:${csoLastOccurrence}`;
}

/**
 * Returns true if csoLastOccurrence is within the last `windowHours` hours.
 * Returns false for invalid / unparseable timestamps.
 */
export function isWithinWindow(
  csoLastOccurrence: string,
  windowHours: number = 48,
): boolean {
  const ts = new Date(csoLastOccurrence).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts <= windowHours * 60 * 60 * 1000;
}

/** Short headline for an active CSO advisory */
export function buildAdvisoryHeadline(outfallName: string): string {
  return `CSO discharge at ${outfallName}`;
}

/**
 * Body copy for an active CSO advisory.
 * Formatted timestamp uses ET (America/New_York) for local readability.
 */
export function buildAdvisoryBody(
  outfallName: string,
  csoLastOccurrence: string,
): string {
  const when = new Date(csoLastOccurrence).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
  return (
    `Combined sewer overflow event recorded ${when} at ${outfallName}. ` +
    `Bacterial levels (E. coli, Enterococci) are likely elevated at downstream ` +
    `access points for approximately 48 hours after a discharge.`
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Minimal shape we expect from a raw EmNet site object */
interface RawSite {
  id: string;
  lat: number;
  lon: number;
  site_config: {
    name: string;
    site_type: string;
    bodies?: string[];
  };
  analysis_results?: {
    overflow?: boolean | null;
    last_overflow_event?: string | null;
    analysis_results?: {
      cso_last_occurrence?: string | null;
    };
  };
}

/** Type guard: does this look like an array of EmNet site objects? */
function looksLikeSiteArray(data: unknown): data is RawSite[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as Record<string, unknown>;
  return (
    typeof first?.id === 'string' &&
    typeof first?.site_config === 'object' &&
    first?.site_config !== null &&
    typeof first?.lat === 'number'
  );
}

/** Normalize a raw API site object to our EmNetSite shape */
function normalizeRawSite(raw: RawSite): EmNetSite {
  const bodies = raw.site_config.bodies ?? [];
  return {
    emnetId: raw.id,
    name: raw.site_config.name,
    lat: raw.lat,
    lng: raw.lon,
    bodies,
    siteType: raw.site_config.site_type,
    affectsJamesMainstem: isJamesMainstem(bodies),
    csoLastOccurrence:
      raw.analysis_results?.analysis_results?.cso_last_occurrence ?? null,
    overflow: raw.analysis_results?.overflow ?? null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch all CSO monitoring sites from the public EmNet map via Cloudflare
 * Browser Rendering (headless Chrome).
 *
 * @param browserBinding  The BROWSER Fetcher binding from wrangler.jsonc
 * @returns Normalized array of all EmNet sites for Richmond (city=47)
 * @throws  If the page fails to load or site data cannot be extracted
 */
export async function fetchEmnetSites(
  browserBinding: BrowserWorker,
): Promise<EmNetSite[]> {
  const browser = await puppeteer.launch(browserBinding);
  try {
    const page = await browser.newPage();

    // ── Step 1: Block tracking/analytics scripts that add latency ─────────
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (
        url.includes('google-analytics') ||
        url.includes('googletagmanager') ||
        url.includes('hotjar') ||
        url.includes('segment.io') ||
        url.includes('mixpanel')
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // ── Step 2: Set up response interception (primary extraction path) ─────
    // Must be set up BEFORE page.goto() so we don't miss the initial API call.
    let capturedRaw: RawSite[] | null = null;

    page.on('response', async (response) => {
      if (capturedRaw) return; // already captured — ignore subsequent responses
      const ct = response.headers()['content-type'] ?? '';
      if (!ct.includes('json')) return;
      try {
        const json = await response.json();
        if (looksLikeSiteArray(json)) {
          capturedRaw = json;
          console.log(`[cso-emnet] captured ${json.length} sites from ${response.url()}`);
        }
      } catch {
        // body already consumed or malformed JSON — ignore
      }
    });

    // ── Step 3: Navigate and wait for network idle ─────────────────────────
    await page.goto(EMNET_URL, { waitUntil: 'networkidle2', timeout: 60_000 });

    // Brief pause for React to process any in-flight state updates after idle.
    // The app polls every ~5 min; first render should be complete by networkidle2.
    await new Promise<void>((r) => setTimeout(r, 2_000));

    // ── Step 4: Fallback — React fiber traversal ───────────────────────────
    if (!capturedRaw) {
      console.warn('[cso-emnet] network interception missed site data — falling back to fiber traversal');

      const fiberResult = await page.evaluate((): unknown[] => {
        const rootEl = document.getElementById('root');
        if (!rootEl) throw new Error('[cso-emnet] no #root element on EmNet page');

        // React 18+ attaches the fiber root via a key like __reactFiber$xxxxxxxx
        const fiberKey = Object.keys(rootEl).find((k) =>
          k.startsWith('__reactFiber$'),
        );
        if (!fiberKey) throw new Error('[cso-emnet] React fiber key not found on #root');

        /**
         * BFS through the fiber tree looking for a hook state that holds
         * an array of EmNet site objects (identified by presence of `site_config`
         * and `id` string on the first element).
         */
        function findSiteArray(rootFiber: unknown): unknown[] | null {
          const queue: unknown[] = [rootFiber];
          const visited = new Set<unknown>();

          while (queue.length > 0) {
            const node = queue.shift() as Record<string, unknown> | null;
            if (!node || typeof node !== 'object' || visited.has(node)) continue;
            visited.add(node);

            // Walk the React hook state linked list (memoizedState chain)
            let hookState: Record<string, unknown> | null =
              (node['memoizedState'] as Record<string, unknown>) ?? null;

            while (hookState) {
              // useReducer/useState: memoizedState holds the value directly
              const stateVal = hookState['memoizedState'];
              // Also check lastRenderedState (useReducer internal)
              const queueVal = (hookState['queue'] as Record<string, unknown> | undefined)
                ?.['lastRenderedState'];

              for (const candidate of [stateVal, queueVal]) {
                if (
                  Array.isArray(candidate) &&
                  candidate.length > 0 &&
                  typeof (candidate[0] as Record<string, unknown>)?.id === 'string' &&
                  typeof (candidate[0] as Record<string, unknown>)?.site_config === 'object'
                ) {
                  return candidate as unknown[];
                }
              }

              hookState =
                (hookState['next'] as Record<string, unknown>) ?? null;
            }

            // Enqueue child and sibling fibers for BFS
            const child = node['child'];
            const sibling = node['sibling'];
            if (child) queue.push(child);
            if (sibling) queue.push(sibling);
          }
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rootFiber = (rootEl as any)[fiberKey];
        const siteList = findSiteArray(rootFiber);

        if (!siteList) {
          throw new Error(
            '[cso-emnet] siteList not found in React fiber tree — EmNet page structure may have changed',
          );
        }

        return siteList;
      });

      if (looksLikeSiteArray(fiberResult)) {
        capturedRaw = fiberResult;
        console.log(`[cso-emnet] fiber traversal captured ${fiberResult.length} sites`);
      } else {
        throw new Error('[cso-emnet] fiber traversal returned unexpected shape');
      }
    }

    if (!capturedRaw || capturedRaw.length === 0) {
      throw new Error('[cso-emnet] no sites extracted from EmNet page');
    }

    return capturedRaw.map(normalizeRawSite);
  } finally {
    await browser.close();
  }
}
