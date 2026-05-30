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
 * Which advisory-ingest branch applies to a given EmNetSite.
 *
 *   'active-overflow' — overflow=true; extend existing advisory or create a new one.
 *   'inactive-window' — overflow=false, recent csoLastOccurrence; standard dedup insert.
 *   'skip'            — non-mainstem, overflow=null, or stale csoLastOccurrence.
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
  if (
    site.overflow === false &&
    site.csoLastOccurrence &&
    isWithinWindow(site.csoLastOccurrence, windowHours)
  ) {
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
 * interpret them as UTC, which throws off the 48h window calculation by 4-5
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
    const inode = inodeByName.get(vSite.name);
    if (!inode || inode.lat == null || inode.lon == null) {
      // No matching physical inode with coordinates — skip.
      continue;
    }
    if (!isValidRichmondCoord(inode.lat, inode.lon)) {
      // Inode exists but has -999 sentinel or out-of-Richmond coords (likely
      // a modeled-only site without a physical sensor). We can't anchor the
      // upstream/downstream computation without real lat/lng, so skip.
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
      lat: inode.lat,
      lng: inode.lon,
      bodies,
      siteType: vSite.site_type,
      affectsJamesMainstem: isJamesMainstem(bodies),
      csoLastOccurrence,
      overflow,
    });
  }

  return sites;
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

    // After networkidle2, the app continues polling /analysis-results/ once
    // per configured site. Wait a bit longer to capture the initial wave —
    // smoke-tested at ~5s for Richmond's ~30 sites.
    await new Promise<void>((r) => setTimeout(r, 5_000));

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
