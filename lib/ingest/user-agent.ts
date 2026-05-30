/**
 * User-Agent strings for outbound requests to data sources.
 *
 * Polite-scraping convention: identify the bot with a project name plus a
 * contact path. We use the project's canonical URL rather than a personal
 * email — operators of data sources who need to reach us can do so via the
 * website (rvajames.org). This keeps the polite-identification benefit
 * without leaking a maintainer email into every external access log.
 *
 * Two variants because some HTML sources match on the exact bot name in
 * robots.txt parsers:
 *
 *   USER_AGENT      → API endpoints (NWS, JRA ArcGIS, NOAA AHPS)
 *   BOT_USER_AGENT  → HTML scrapers (closure sources). The name string
 *                     (without parens) is what robots.txt User-agent lines
 *                     match — see uses of BOT_NAME in
 *                     lib/ingest/closures/sources/{jrps,venture-richmond}.ts.
 */

const PROJECT_URL = 'https://rvajames.org';

/** Bot identifier as used in robots.txt User-agent: blocks. */
export const BOT_NAME = 'rva-james-bot';

/** Full User-Agent header for API requests. */
export const USER_AGENT = `rva-james (${PROJECT_URL})`;

/** Full User-Agent header for HTML/RSS scrapers. */
export const BOT_USER_AGENT = `${BOT_NAME} (${PROJECT_URL})`;
