/**
 * scripts/patch-worker.mjs
 *
 * Injected after `opennextjs-cloudflare build` via the `build:cf` script.
 *
 * OpenNext generates a worker.js that only exports a `fetch()` handler.
 * Cloudflare cron triggers call `scheduled()` — which doesn't exist — causing
 * every cron job to fail with "Handler does not export a scheduled() function".
 *
 * This script patches `.open-next/worker.js` to:
 *   1. Replace `export default { ... }` with a named const `_nextHandler`
 *   2. Append a new `export default` that spreads `_nextHandler` and adds a
 *      `scheduled()` method that dispatches internally to the correct API route.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, '../.open-next/worker.js');

// Cron schedule → internal API route path (must match wrangler.jsonc triggers)
const CRON_ROUTES = {
  '*/15 * * * *': '/api/cron/usgs',
  '0 * * * *': '/api/cron/nws',
  '0 3 * * *': '/api/cron/usgs-percentiles',
  '0 12 * * *': '/api/cron/jra',
  '0 6,18 * * *': '/api/cron/cso',
};

if (!existsSync(workerPath)) {
  console.log('[patch-worker] .open-next/worker.js not found — skipping (run build:cf first).');
  process.exit(0);
}

let source = readFileSync(workerPath, 'utf-8');

// Guard: if the patch has already been applied (re-running the script), skip.
if (source.includes('_nextHandler')) {
  console.log('[patch-worker] Already patched — skipping.');
  process.exit(0);
}

// Guard: confirm the expected structure is present.
if (!source.includes('export default {')) {
  console.error('[patch-worker] ERROR: expected "export default {" not found in worker.js — patch aborted.');
  process.exit(1);
}

// Step 1: rename the default export to a named const
source = source.replace('export default {', 'const _nextHandler = {');

// Step 2: append the scheduled handler + new default export
source += `
// ── Cron scheduled handler (injected by scripts/patch-worker.mjs) ─────────────
// Maps Cloudflare cron schedules to Next.js API routes and dispatches internally.
const _CRON_ROUTES = ${JSON.stringify(CRON_ROUTES, null, 4)};

export default {
    ..._nextHandler,
    async scheduled(event, env, ctx) {
        const path = _CRON_ROUTES[event.cron];
        if (!path) {
            console.error('[cron] No route mapped for schedule:', event.cron);
            return;
        }
        console.log('[cron] Firing', event.cron, '->', path);
        // Dispatch to Next.js handler directly (no real network round-trip).
        // Uses rvajames.org as the host so Next.js routing resolves correctly;
        // the fetch call never leaves the Worker process.
        const req = new Request('https://rvajames.org' + path, {
            headers: { 'x-cron-secret': env.CRON_SECRET ?? '' },
        });
        try {
            const resp = await _nextHandler.fetch(req, env, ctx);
            const body = await resp.text().catch(() => '');
            if (!resp.ok) {
                console.error('[cron]', event.cron, 'HTTP', resp.status, body.slice(0, 300));
            } else {
                console.log('[cron]', event.cron, 'OK', resp.status, body.slice(0, 100));
            }
        } catch (err) {
            console.error('[cron]', event.cron, 'threw:', err);
        }
    },
};
`;

writeFileSync(workerPath, source, 'utf-8');
console.log('[patch-worker] scheduled() handler injected into .open-next/worker.js ✓');
console.log('[patch-worker] Routes:', Object.entries(CRON_ROUTES).map(([k, v]) => `\n  ${k} → ${v}`).join(''));
