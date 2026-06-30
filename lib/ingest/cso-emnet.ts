/**
 * EmNet CSO ingest — Cloudflare Browser Rendering
 *
 * Fetches Richmond DPU combined sewer overflow data from the public EmNet map
 * (apps.emnet.net/richmond-pub-map-app) via headless browser.
 *
 * The EmNet map is the authoritative source for CSO monitoring sites since
 * DPU retired its rva.gov advisory pages in 2026.
 *
 * ── Extraction strategy: capture + join ───────────────────────────────────────
 *
 * The earlier "single joined endpoint" assumption was wrong — verified during
 * the 2026-05-29 smoke test. EmNet's REST API is normalized across four
 * endpoints; the React app performs the join client-side. We replicate the
 * join from intercepted network responses rather than depending on React
 * internals (which were fragile: React 18 createRoot attaches a FiberRoot
 * via __reactContainer$, and the state shape changes with EmNet UI updates).
 *
 * Endpoints we capture during page load:
 *
 *   GET /api/tables/visualizations/47/?uuid=<config-uuid>
 *     → [{ visualization: { sites: [{ name, site_type, bodies, analysis_config_id }] } }]
 *
 *   GET /api/tables/inodes/47/
 *     → [{ name, description, lat, lon, sens_type1, ... }]
 *
 *   GET /api/tables/analysis-results/47/?analysis-configuration-id=N
 *     → [{ analysis_configuration_id, analysis_results: { analysis_results: {
 *           cso_last_occurrence, cso_active_overflow, ... } } }]
 *     (one call per analysis_config_id from the visualization; the app fires
 *      these in waves on initial load + on its polling interval)
 *
 * Join keys:
 *
 *   visualization.site.name ←→ inode.description   (e.g. both "CSO 34")
 *     → yields lat/lng for each site
 *
 *   visualization.site.analysis_config_id ←→ analysis-results.analysis_configuration_id
 *     → yields cso_last_occurrence + cso_active_overflow per site
 *
 * Bodies default:
 *
 *   The /visualizations/ endpoint returns site.bodies as an empty string for
 *   Richmond. All Richmond CSO outfalls discharge to the James River
 *   mainstem (the city's combined sewer system is entirely along the river
 *   corridor), so we default to ["James River"] when bodies is missing or
 *   empty. If EmNet ever starts populating bodies, the parsing takes
 *   precedence over the default.
 */

import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';
import thresholds from '@/lib/safety/thresholds.json';

export const EMNET_URL =
  'https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9';

/** Water body name patterns that indicate James River mainstem (case-insensitive) */
const JAMES_MAINSTEM_PATTERNS = ['james river', 'james'];

/**
 * Authoritative coordinates for CSO outfalls that EmNet reports as modeled-only
 * (lat/lon = -999 sentinel, coord_x/coord_y = 0), which would otherwise be
 * dropped by the join — leaving real overflow sites invisible. CSO 6 is the
 * metro's largest outfall (Shockoe / ~14th St, ~80% of annual CSO volume), so
 * its absence materially understated the metro picture.
 *
 * Source: EPA National CSO Outfall Inventory (ICIS-NPDES), permit VA0063177.
 * EmNet's "CSO N" maps to EPA PERM_FEATURE_NMBR "0NN" — verified 2026-06-23 by
 * matching ~20 EmNet-geolocated sites to EPA outfalls (all within ~50 m). CSO 6
 * sits just east of CSO 7, consistent with both being either side of 14th St.
 * Keyed by EmNet site name. Only applied when EmNet gives no usable coords.
 */
const OUTFALL_COORD_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  'CSO 6':  { lat: 37.5310, lng: -77.4318 },
  'CSO 16': { lat: 37.5244, lng: -77.4617 },
};

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
 * Which advisory-ingest branch applies to a given EmNetSite.
 *
 *   'active-overflow' — overflow=true; extend existing advisory or create a new one.
 *   'inactive-window' — not currently overflowing (overflow=false OR null) but a
 *                       confirmed csoLastOccurrence within the window; dedup insert.
 *   'skip'            — non-mainstem, or no recent csoLastOccurrence in the window.
 *
 * Pure function — exported for unit testing. The actual I/O lives in cso.ts.
 */
export type AdvisoryBranch = 'active-overflow' | 'inactive-window' | 'skip';

export function selectAdvisoryBranch(
  site: Pick<EmNetSite, 'affectsJamesMainstem' | 'overflow' | 'csoLastOccurrence'>,
  windowHours: number,
): AdvisoryBranch {
  if (!site.affectsJamesMainstem) return 'skip';
  if (site.overflow === true) return 'active-overflow';
  // overflow is now false OR null (EmNet didn't report a live current-state
  // flag). A confirmed csoLastOccurrence within the window is itself evidence
  // of a real recent discharge — surface it regardless of the flag (bacterial
  // impact persists for the CSO window). Previously this required overflow===false, which
  // dropped real events whenever the flag was null: in prod 2026-06-23, CSO
  // 11/15/20 near Belle Isle had recent events but null overflow, so they were
  // skipped, never became advisories, and Belle Isle wrongly read "No overflows
  // upstream." Missing a real upstream overflow is worse than an extra advisory.
  if (site.csoLastOccurrence && isWithinWindow(site.csoLastOccurrence, windowHours)) {
    return 'inactive-window';
  }
  return 'skip';
}

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
  windowHours: number = thresholds.cso.swim_hold_hours,
): boolean {
  const ts = new Date(csoLastOccurrence).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts <= windowHours * 60 * 60 * 1000;
}

/**
 * effective_to for a CSO advisory: `windowHours` after the actual discharge
 * event, NOT relative to "now". Anchoring to the event means a persistently-true
 * EmNet overflow flag can't extend the advisory past the real contamination
 * window — the bump is idempotent and a stuck flag self-expires once the event
 * ages out. (See the CSO 12 zombie-advisory incident, 2026-06-30.)
 */
export function advisoryEffectiveTo(csoLastOccurrence: string, windowHours: number): string {
  return new Date(
    new Date(csoLastOccurrence).getTime() + windowHours * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Resolve EmNet's `cso_active_overflow` flag into a trustworthy "discharging
 * now" value for storage. EmNet's flag can stick `true` for weeks while the
 * site's last actual occurrence stays frozen (observed on CSO 12). Treat an
 * active flag as genuine only when its occurrence is recent (within the window)
 * or absent; a `true` flag with a stale occurrence is a stuck flag → `false`.
 * `false`/`null` pass through unchanged.
 */
export function resolveCurrentOverflow(
  overflow: boolean | null,
  csoLastOccurrence: string | null,
  windowHours: number,
): boolean | null {
  if (overflow !== true) return overflow;
  if (!csoLastOccurrence) return true;
  return isWithinWindow(csoLastOccurrence, windowHours);
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
    `access points for approximately ${thresholds.cso.swim_hold_hours} hours after a discharge.`
  );
}

// ── Internal types — match the three EmNet endpoints we capture ───────────────

/** Sites from /api/tables/visualizations/47/?uuid=... */
interface EmNetVisualizationSite {
  name: string;
  note?: string;
  bodies?: string; // empty string in current Richmond data
  site_type: string;
  analysis_config_id: number;
}

/** Inodes from /api/tables/inodes/47/ */
interface EmNetInode {
  id: number;
  name: string;
  description: string;
  lat?: number;
  lon?: number;
}

/** Result rows from /api/tables/analysis-results/47/?analysis-configuration-id=N */
interface EmNetAnalysisResult {
  analysis_configuration_id: number;
  analysis_results?: {
    analysis_results?: {
      cso_last_occurrence?: string | null;
      cso_active_overflow?: boolean | null;
    };
  };
}

/**
 * Parse a bodies field from the visualization site. EmNet currently returns
 * an empty string for Richmond. Default to ["James River"] — Richmond's
 * combined sewer system discharges entirely to the James mainstem along the
 * river corridor, so this default is geographically correct.
 *
 * If EmNet ever populates bodies, comma-split takes precedence.
 */
function parseBodies(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return ['James River'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Reject EmNet's `-999` sentinel values and out-of-Richmond-bbox coordinates.
 * Modeled-only sites without a physical sensor encode their missing coords
 * as `lat: -999, lon: -999`. Richmond's CSO outfalls cluster around
 * lat ~37.5, lng ~-77.4 — a generous bbox catches both real coordinates and
 * flags obvious sentinels.
 */
function isValidRichmondCoord(lat: number, lng: number): boolean {
  return lat > 37 && lat < 38 && lng < -77 && lng > -78;
}

/**
 * EmNet timestamps lack a timezone marker (e.g. "2026-05-27T18:40:00"). They
 * are reported in Richmond local time (America/New_York). `new Date()` would
 * interpret them as UTC, which throws off the CSO window calculation by 4-5
 * hours depending on DST. Normalize by appending an explicit ET offset.
 *
 * DST handling: Richmond observes EDT (UTC-04:00) roughly Mar 14 - Nov 7 and
 * EST (UTC-05:00) the rest of the year. We pick the offset by the timestamp's
 * own month/day rather than the wall-clock at ingest time so a timestamp from
 * a previous DST regime is interpreted correctly.
 *
 * Returns null if the input is missing/empty; returns the original string
 * unchanged if it already has a Z or numeric TZ offset.
 */
export function normalizeEmnetTimestamp(ts: string | null | undefined): string | null {
  if (!ts) return null;
  // Already has TZ marker — keep as-is.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(ts)) return ts;
  // Parse the month + day to decide DST vs standard time.
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ts; // unrecognized shape — return as-is rather than corrupt
  const month = Number(m[2]);
  const day = Number(m[3]);
  // DST in US: 2nd Sunday of March to 1st Sunday of November.
  // Quick approximation: Mar 14 - Nov 7 → EDT, otherwise EST.
  const isEDT =
    (month > 3 && month < 11) ||
    (month === 3 && day >= 14) ||
    (month === 11 && day <= 7);
  return `${ts}${isEDT ? '-04:00' : '-05:00'}`;
}

/**
 * Performs the four-way join from captured EmNet responses.
 * Exported for unit testing of the join logic without needing a browser.
 */
export function joinEmnetData(
  visualizationSites: EmNetVisualizationSite[],
  inodes: EmNetInode[],
  analysisResultsByConfigId: Map<number, EmNetAnalysisResult>,
): EmNetSite[] {
  // inode.description is the human-readable name (e.g. "CSO 20") that matches
  // visualization.site.name. Build a lookup map for O(1) join.
  //
  // EmNet's /inodes/ endpoint can return MULTIPLE entries per outfall — one
  // per physical sensor (depth, flow, rain, etc.). Most have lat/lng of
  // -999/-999 (sentinel for "no physical coords") and only one entry per
  // outfall has the real coordinates. Prefer the entry with valid Richmond
  // coords; fall back to whichever we saw first if none match.
  const inodeByName = new Map<string, EmNetInode>();
  for (const inode of inodes) {
    const existing = inodeByName.get(inode.description);
    if (!existing) {
      inodeByName.set(inode.description, inode);
      continue;
    }
    const newIsValid =
      inode.lat != null && inode.lon != null &&
      isValidRichmondCoord(inode.lat, inode.lon);
    const existingIsValid =
      existing.lat != null && existing.lon != null &&
      isValidRichmondCoord(existing.lat, existing.lon);
    if (newIsValid && !existingIsValid) {
      inodeByName.set(inode.description, inode);
    }
  }

  const sites: EmNetSite[] = [];
  for (const vSite of visualizationSites) {
    // Resolve coordinates: prefer EmNet's physical inode; fall back to an
    // authoritative override for outfalls EmNet only models (-999 sentinel).
    const inode = inodeByName.get(vSite.name);
    const override = OUTFALL_COORD_OVERRIDES[vSite.name];
    let lat: number;
    let lng: number;
    if (inode && inode.lat != null && inode.lon != null && isValidRichmondCoord(inode.lat, inode.lon)) {
      lat = inode.lat;
      lng = inode.lon;
    } else if (override) {
      // EmNet has no usable coords for this outfall (modeled-only). Use the
      // authoritative coordinate so a real overflow site isn't silently dropped.
      lat = override.lat;
      lng = override.lng;
    } else {
      // No physical inode coords and no override — can't anchor the
      // upstream/downstream computation, so skip (e.g. depth-only monitors).
      continue;
    }

    const result = analysisResultsByConfigId.get(vSite.analysis_config_id);
    const innerResults = result?.analysis_results?.analysis_results;
    const csoLastOccurrence = normalizeEmnetTimestamp(innerResults?.cso_last_occurrence);
    const overflow = innerResults?.cso_active_overflow ?? null;

    const bodies = parseBodies(vSite.bodies);

    sites.push({
      // emnet_id needs to be stable across runs. analysis_config_id is the
      // most stable identifier — tied to the sensor config and doesn't change
      // across EmNet's polling cycles.
      emnetId: String(vSite.analysis_config_id),
      name: vSite.name,
      lat,
      lng,
      bodies,
      siteType: vSite.site_type,
      affectsJamesMainstem: isJamesMainstem(bodies),
      csoLastOccurrence,
      overflow,
    });
  }

  return sites;
}

/**
 * True once every visualization site the join will keep has its analysis-results
 * captured. "Keep" = the site has a valid Richmond-coord inode OR an authoritative
 * coordinate override (CSO 6/16). Sites with neither (e.g. depth-only monitors)
 * are dropped by the join anyway, so we deliberately do NOT wait on
 * analysis-results that will never arrive for them — otherwise every scrape would
 * burn the full timeout.
 *
 * Used by fetchEmnetSites to replace a fixed wait with poll-until-complete:
 * EmNet fires one /analysis-results/ call per site in waves, and a fixed wait
 * raced them (smoke tests captured only 11–15 of 22 sites per run), silently
 * dropping real overflows. Returns false while still loading (no viz sites yet).
 */
export function analysisCoverageComplete(
  visualizationSites: EmNetVisualizationSite[],
  inodes: EmNetInode[],
  analysisResultsByConfigId: Map<number, EmNetAnalysisResult>,
): boolean {
  const needed = visualizationSites.filter(
    (v) =>
      v.name in OUTFALL_COORD_OVERRIDES ||
      inodes.some(
        (i) =>
          i.description === v.name &&
          i.lat != null &&
          i.lon != null &&
          isValidRichmondCoord(i.lat, i.lon),
      ),
  );
  if (needed.length === 0) return false;
  return needed.every((v) => analysisResultsByConfigId.has(v.analysis_config_id));
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

    // ── Step 2: Capture the three endpoint shapes into maps ────────────────
    // Must be set up BEFORE page.goto() so we don't miss the initial API calls.
    const visualizationSites: EmNetVisualizationSite[] = [];
    const inodes: EmNetInode[] = [];
    const analysisResultsByConfigId = new Map<number, EmNetAnalysisResult>();

    page.on('response', async (response) => {
      const url = response.url();
      // Only inspect EmNet REST API responses
      if (!url.includes('restapi.emnet.net/api/tables/')) return;
      const ct = response.headers()['content-type'] ?? '';
      if (!ct.includes('json')) return;

      try {
        // Read as text first so the body isn't consumed by CDP — JSON.parse
        // then handles both the parse and the wider type-narrowing.
        const text = await response.text();
        const json: unknown = JSON.parse(text);

        if (url.includes('/tables/visualizations/')) {
          // Shape: [{ id, visualization: { sites: [...] } }]
          if (
            Array.isArray(json) &&
            json[0] &&
            typeof json[0] === 'object' &&
            (json[0] as { visualization?: { sites?: unknown[] } }).visualization?.sites
          ) {
            const sites = (json[0] as { visualization: { sites: EmNetVisualizationSite[] } })
              .visualization.sites;
            visualizationSites.push(...sites);
          }
        } else if (url.includes('/tables/inodes/')) {
          // Shape: [{ id, name, description, lat, lon, ... }]
          if (Array.isArray(json)) {
            inodes.push(...(json as EmNetInode[]));
          }
        } else if (url.includes('/tables/analysis-results/')) {
          // Shape: [{ analysis_configuration_id, analysis_results: { analysis_results: {...} } }]
          if (Array.isArray(json)) {
            for (const r of json as EmNetAnalysisResult[]) {
              if (typeof r?.analysis_configuration_id === 'number') {
                analysisResultsByConfigId.set(r.analysis_configuration_id, r);
              }
            }
          }
        }
      } catch {
        // Body already consumed, malformed JSON, or response error — ignore.
        // We tolerate missing per-endpoint data; the final join skips sites
        // without the data needed.
      }
    });

    // ── Step 3: Navigate and wait for the page + initial polling to settle ─
    await page.goto(EMNET_URL, { waitUntil: 'networkidle2', timeout: 60_000 });

    // After networkidle2 the app fires one /analysis-results/ call per site in
    // waves. A fixed wait raced them (smoke tests captured only 11–15 of 22
    // sites per run, non-deterministically — silently dropping real overflows
    // like CSO 20/21/24). Poll until every valid-coord site has its
    // analysis-results, capped at MAX_WAIT_MS so a never-reporting site can't
    // hang the scrape. The per-site response handler keeps mutating the maps
    // between polls, so coverage grows as we wait.
    const MAX_WAIT_MS = 20_000;
    const POLL_MS = 400;
    const waitStart = Date.now();
    while (Date.now() - waitStart < MAX_WAIT_MS) {
      if (analysisCoverageComplete(visualizationSites, inodes, analysisResultsByConfigId)) {
        break;
      }
      await new Promise<void>((r) => setTimeout(r, POLL_MS));
    }
    console.log(
      `[cso-emnet] analysis-results wait settled after ${Date.now() - waitStart}ms — ` +
      `${analysisResultsByConfigId.size} results captured for ${visualizationSites.length} viz sites`,
    );

    // ── Step 4: Join the three captures into EmNetSite[] ───────────────────
    if (visualizationSites.length === 0) {
      throw new Error(
        '[cso-emnet] no visualization sites captured from EmNet page — ' +
        'API surface may have changed',
      );
    }
    if (inodes.length === 0) {
      throw new Error(
        '[cso-emnet] no inodes captured from EmNet page — API surface may have changed',
      );
    }

    const sites = joinEmnetData(visualizationSites, inodes, analysisResultsByConfigId);

    if (sites.length === 0) {
      throw new Error(
        '[cso-emnet] join produced 0 sites — likely no inode descriptions matched ' +
        'visualization site names (EmNet may have changed the join key)',
      );
    }

    console.log(
      `[cso-emnet] captured ${visualizationSites.length} visualization sites, ` +
      `${inodes.length} inodes, ${analysisResultsByConfigId.size} analysis results → ` +
      `joined ${sites.length} EmNetSite records`,
    );

    return sites;
  } finally {
    await browser.close();
  }
}
