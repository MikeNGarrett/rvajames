# Website Audit: https://rvajames.org

*Audited against [The Website Specification](https://specification.website/) · Run ID: `2026-06-12T02-34-22-Z` · 11 June 2026*

---

## Scorecard

_Pass rate is over decided items only (automated pass/fail plus operator-reviewed items); items awaiting manual review are never blended into the percentage. Details per item are in Findings by Category below._

| Category | Pass rate | ✅ Pass | ❌ Fail | 👤 Reviewed | ⚠️ Awaiting review |
| --- | --- | --- | --- | --- | --- |
| Foundations | 100% (8/8 decided) | 8 | 0 | — | 6 |
| Seo | 100% (6/6 decided) | 6 | 0 | — | 7 |
| Accessibility | 100% (15/15 decided) | 15 | 0 | — | 4 |
| Security | 73% (8/11 decided) | 8 | 3 | — | 2 |
| Well-known | 100% (1/1 decided) | 1 | 0 | — | 7 |
| Agent-readiness | 100% (6/6 decided) | 6 | 0 | — | 12 |
| Performance | 100% (9/9 decided) | 9 | 0 | — | 12 |
| Privacy | 50% (1/2 decided) | 1 | 1 | — | 4 |
| Resilience | 100% (1/1 decided) | 1 | 0 | — | 5 |
| **Overall** | **93% (55/59 decided)** | **55** | **4** | **—** | **59** |

---

## Changes Since Last Run

_Compared against run `2026-05-31T02-31-02-Z` (30 May 2026)._

**✅ Fixed (6)**

- Structured data (JSON-LD) (seo) — fail → pass [spec ↗](https://specification.website/spec/seo/structured-data/)
- HSTS (Strict-Transport-Security) (security) — fail → pass [spec ↗](https://specification.website/spec/security/hsts/)
- /.well-known/security.txt (security) — fail → pass [spec ↗](https://specification.website/spec/security/security-txt/)
- /llms.txt (agent-readiness) — fail → pass [spec ↗](https://specification.website/spec/agent-readiness/llms-txt/)
- Structured data for agents (agent-readiness) — fail → pass [spec ↗](https://specification.website/spec/agent-readiness/structured-data-for-agents/)
- Machine-readable formats (agent-readiness) — fail → pass [spec ↗](https://specification.website/spec/agent-readiness/machine-readable-formats/)

**🆕 Newly auto-decided (was manual review) (8)**

- DNS CAA records (security) — manual-review → fail [spec ↗](https://specification.website/spec/security/caa-records/)
- DNSSEC (security) — manual-review → fail [spec ↗](https://specification.website/spec/security/dnssec/)
- Well-known URIs (well-known) — manual-review → pass [spec ↗](https://specification.website/spec/well-known/well-known-overview/)
- Core Web Vitals (LCP, INP, CLS) (performance) — manual-review → pass [spec ↗](https://specification.website/spec/performance/core-web-vitals/)
- Critical CSS and render-blocking resources (performance) — manual-review → pass [spec ↗](https://specification.website/spec/performance/critical-css/)
- Cookie consent (privacy) — manual-review → fail [spec ↗](https://specification.website/spec/privacy/cookie-consent/)
- Third-party scripts and privacy (privacy) — manual-review → pass [spec ↗](https://specification.website/spec/privacy/third-party-scripts/)
- Custom error pages (404, 500) (resilience) — manual-review → pass [spec ↗](https://specification.website/spec/resilience/error-pages/)

**➕ Added to the spec since baseline (25)**

- <meta name="color-scheme"> (foundations) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/foundations/color-scheme/)
- Feed content hygiene (foundations) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/foundations/feed-hygiene/)
- Popover API (foundations) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/foundations/popover-api/)
- Server-side rendering (seo) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/seo/server-side-rendering/)
- Hidden until found (accessibility) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/accessibility/hidden-until-found/)
- Mobile-friendly form inputs (accessibility) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/accessibility/mobile-form-inputs/)
- Native interactive elements (accessibility) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/accessibility/native-interactive-elements/)
- CSS state and relational selectors (accessibility) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/accessibility/css-state-selectors/)
- Mixed content and upgrade-insecure-requests (security) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/security/mixed-content/)
- /.well-known/webauthn (well-known) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/well-known/webauthn/)
- /.well-known/traffic-advice (well-known) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/well-known/traffic-advice/)
- Conditional requests (ETag, Last-Modified, 304) (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/conditional-requests/)
- Back/forward cache (BFCache) (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/bfcache/)
- Visibility-aware rendering (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/visibility-aware-rendering/)
- CSS containment (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/css-containment/)
- Scroll-driven animations (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/scroll-driven-animations/)
- Scrollbar gutter (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/scrollbar-gutter/)
- Dynamic viewport units (dvh, svh, lvh) (performance) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/performance/dynamic-viewport-units/)
- Graceful degradation when JavaScript fails (resilience) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/resilience/graceful-degradation/)
- International URL structure (i18n) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/i18n/international-url-structure/)
- Localised page metadata (i18n) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/i18n/localised-metadata/)
- hreflang in XML sitemaps (i18n) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/i18n/sitemap-hreflang/)
- Language switcher (i18n) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/i18n/language-switcher/)
- Writing modes and CJK line breaking (i18n) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/i18n/writing-modes/)
- Plural rules and grammatical number (i18n) — not in baseline spec → manual-review [spec ↗](https://specification.website/spec/i18n/plural-rules/)

_92 item(s) unchanged._

---

## Executive Summary

This audit evaluates **https://rvajames.org** against [The Website Specification](https://specification.website/) as snapshotted on 11 June 2026. The audit ran on 11 June 2026 across 131 spec items.

**Results at a glance:**

| Metric | Count |
| --- | --- |
| ✅ Pass | 55 |
| ❌ Fail | 4 |
| ⚠️ Manual review required | 59 |
| — N/A (out of scope) | 13 |
| ↓ Deprioritised | 10 |

**1 high-priority issue require immediate attention** (details in Prioritized Recommendations):

- **Cookie consent** (privacy)

> This report was generated by spec-check run `2026-06-12T02-34-22-Z`. Re-render at any time with: `spec-check report 2026-06-12T02-34-22-Z`

---

## Data Sources & Coverage

| Source | Status | Detail |
| --- | --- | --- |
| HTTP headers / redirect | ✅ Collected | Final URL: https://rvajames.org/ · HTTP→HTTPS ✅ |
| TLS certificate | ✅ Collected | TLSv1.3 · cert expires in 70d |
| robots.txt / sitemap | ✅ Collected | robots.txt ✅ · sitemaps: 1 found |
| Structured data | ✅ Collected | 1 JSON-LD schema(s): Organization, WebSite |
| Accessibility | ✅ Collected | Provider: pa11y-axe · 11 finding(s) |
| Screaming Frog crawl | ⚠️ Gap | Not run (add --crawl flag to enable) |

**Gaps — evidence not available for these sources:**

- screaming-frog: Screaming Frog produced no export files in /Users/mikegarrett/Sites/rva-james/.audit/runs/2026-06-12T02-34-22-Z/screaming-frog — the crawl likely failed (check the Screaming Frog log output above).
- browserstack: No BrowserStack scan found matching host: rvajames.org — set an explicit scan id (spec-check setup --bs-scan-id <id>) — falling back to pa11y-axe

---

## Spec Snapshot

_This section records exactly which spec items and statuses were evaluated, ensuring this report remains defensible after the spec changes._

| Field | Value |
| --- | --- |
| Retrieved | 11 June 2026 |
| Endpoint | https://mcp.specification.website/mcp |
| Server | specification-website v0.1.0 |
| Categories | 10 |
| Items evaluated | 131 total (36 required · 69 recommended · 26 optional) |

<details>
<summary>Full item list (click to expand)</summary>

| Category | Item | Status | Source |
| --- | --- | --- | --- |
| foundations | The HTML doctype | required | [↗](https://specification.website/spec/foundations/doctype/) |
| foundations | The lang attribute on <html> | required | [↗](https://specification.website/spec/foundations/html-lang/) |
| foundations | <meta charset> | required | [↗](https://specification.website/spec/foundations/meta-charset/) |
| foundations | <meta viewport> | required | [↗](https://specification.website/spec/foundations/meta-viewport/) |
| foundations | The <title> element | required | [↗](https://specification.website/spec/foundations/title/) |
| foundations | <meta name="description"> | recommended | [↗](https://specification.website/spec/foundations/meta-description/) |
| foundations | Canonical URL (rel="canonical") | recommended | [↗](https://specification.website/spec/foundations/canonical-url/) |
| foundations | Favicons and app icons | recommended | [↗](https://specification.website/spec/foundations/favicons/) |
| foundations | <meta name="theme-color"> | recommended | [↗](https://specification.website/spec/foundations/theme-color/) |
| foundations | <meta name="color-scheme"> | recommended | [↗](https://specification.website/spec/foundations/color-scheme/) |
| foundations | Open Graph protocol | recommended | [↗](https://specification.website/spec/foundations/open-graph/) |
| foundations | Feed discovery with rel="alternate" | recommended | [↗](https://specification.website/spec/foundations/feed-discovery/) |
| foundations | Feed content hygiene | recommended | [↗](https://specification.website/spec/foundations/feed-hygiene/) |
| foundations | Popover API | recommended | [↗](https://specification.website/spec/foundations/popover-api/) |
| seo | robots.txt | recommended | [↗](https://specification.website/spec/seo/robots-txt/) |
| seo | XML sitemaps | recommended | [↗](https://specification.website/spec/seo/xml-sitemaps/) |
| seo | Sitemap index files | recommended | [↗](https://specification.website/spec/seo/sitemap-index/) |
| seo | Image and video sitemap extensions | optional | [↗](https://specification.website/spec/seo/image-sitemaps/) |
| seo | URL structure | recommended | [↗](https://specification.website/spec/seo/url-structure/) |
| seo | Redirects (301/302/308) | required | [↗](https://specification.website/spec/seo/redirects/) |
| seo | Server-side rendering | recommended | [↗](https://specification.website/spec/seo/server-side-rendering/) |
| seo | Meta robots and X-Robots-Tag | required | [↗](https://specification.website/spec/seo/meta-robots/) |
| seo | Heading hierarchy | required | [↗](https://specification.website/spec/seo/heading-hierarchy/) |
| seo | Internal linking | recommended | [↗](https://specification.website/spec/seo/internal-linking/) |
| seo | Structured data (JSON-LD) | recommended | [↗](https://specification.website/spec/seo/structured-data/) |
| seo | Breadcrumbs | recommended | [↗](https://specification.website/spec/seo/breadcrumbs/) |
| seo | IndexNow | optional | [↗](https://specification.website/spec/seo/indexnow/) |
| accessibility | Colour contrast | required | [↗](https://specification.website/spec/accessibility/color-contrast/) |
| accessibility | Image alt text | required | [↗](https://specification.website/spec/accessibility/image-alt-text/) |
| accessibility | Form labels | required | [↗](https://specification.website/spec/accessibility/form-labels/) |
| accessibility | Keyboard navigation | required | [↗](https://specification.website/spec/accessibility/keyboard-navigation/) |
| accessibility | Visible focus indicators | required | [↗](https://specification.website/spec/accessibility/focus-indicators/) |
| accessibility | Skip links | required | [↗](https://specification.website/spec/accessibility/skip-links/) |
| accessibility | Semantic HTML and landmarks | required | [↗](https://specification.website/spec/accessibility/semantic-html/) |
| accessibility | ARIA — first rule of ARIA | recommended | [↗](https://specification.website/spec/accessibility/aria-usage/) |
| accessibility | Descriptive link text | required | [↗](https://specification.website/spec/accessibility/link-text/) |
| accessibility | Accessible form errors | required | [↗](https://specification.website/spec/accessibility/form-errors/) |
| accessibility | Document and parts language | required | [↗](https://specification.website/spec/accessibility/document-language/) |
| accessibility | Reduced motion | required | [↗](https://specification.website/spec/accessibility/reduced-motion/) |
| accessibility | Captions and transcripts | required | [↗](https://specification.website/spec/accessibility/captions-and-transcripts/) |
| accessibility | Accessible data tables | required | [↗](https://specification.website/spec/accessibility/data-tables/) |
| accessibility | Touch target size | required | [↗](https://specification.website/spec/accessibility/touch-target-size/) |
| accessibility | Hidden until found | recommended | [↗](https://specification.website/spec/accessibility/hidden-until-found/) |
| accessibility | Mobile-friendly form inputs | recommended | [↗](https://specification.website/spec/accessibility/mobile-form-inputs/) |
| accessibility | Native interactive elements | recommended | [↗](https://specification.website/spec/accessibility/native-interactive-elements/) |
| accessibility | CSS state and relational selectors | recommended | [↗](https://specification.website/spec/accessibility/css-state-selectors/) |
| security | HTTPS and TLS | required | [↗](https://specification.website/spec/security/https-tls/) |
| security | HSTS (Strict-Transport-Security) | required | [↗](https://specification.website/spec/security/hsts/) |
| security | Mixed content and upgrade-insecure-requests | recommended | [↗](https://specification.website/spec/security/mixed-content/) |
| security | Content Security Policy (CSP) | recommended | [↗](https://specification.website/spec/security/content-security-policy/) |
| security | /.well-known/security.txt | recommended | [↗](https://specification.website/spec/security/security-txt/) |
| security | X-Content-Type-Options: nosniff | required | [↗](https://specification.website/spec/security/x-content-type-options/) |
| security | Clickjacking protection (frame-ancestors / X-Frame-Options) | required | [↗](https://specification.website/spec/security/frame-ancestors/) |
| security | Referrer-Policy | recommended | [↗](https://specification.website/spec/security/referrer-policy/) |
| security | Permissions-Policy | recommended | [↗](https://specification.website/spec/security/permissions-policy/) |
| security | Subresource Integrity (SRI) | recommended | [↗](https://specification.website/spec/security/subresource-integrity/) |
| security | Cookie attributes — Secure, HttpOnly, SameSite | required | [↗](https://specification.website/spec/security/cookie-attributes/) |
| security | DNS CAA records | recommended | [↗](https://specification.website/spec/security/caa-records/) |
| security | DNSSEC | optional | [↗](https://specification.website/spec/security/dnssec/) |
| well-known | Well-known URIs | recommended | [↗](https://specification.website/spec/well-known/well-known-overview/) |
| well-known | /.well-known/change-password | optional | [↗](https://specification.website/spec/well-known/change-password/) |
| well-known | /.well-known/webauthn | optional | [↗](https://specification.website/spec/well-known/webauthn/) |
| well-known | /.well-known/openid-configuration | optional | [↗](https://specification.website/spec/well-known/openid-configuration/) |
| well-known | /.well-known/api-catalog | recommended | [↗](https://specification.website/spec/well-known/api-catalog/) |
| well-known | /.well-known/webfinger | optional | [↗](https://specification.website/spec/well-known/webfinger/) |
| well-known | /.well-known/apple-app-site-association | optional | [↗](https://specification.website/spec/well-known/apple-app-site-association/) |
| well-known | /.well-known/assetlinks.json | optional | [↗](https://specification.website/spec/well-known/assetlinks-json/) |
| well-known | /.well-known/nodeinfo | optional | [↗](https://specification.website/spec/well-known/nodeinfo/) |
| well-known | /.well-known/traffic-advice | optional | [↗](https://specification.website/spec/well-known/traffic-advice/) |
| agent-readiness | Agent readiness | recommended | [↗](https://specification.website/spec/agent-readiness/agent-readiness-overview/) |
| agent-readiness | /llms.txt | recommended | [↗](https://specification.website/spec/agent-readiness/llms-txt/) |
| agent-readiness | /llms-full.txt | optional | [↗](https://specification.website/spec/agent-readiness/llms-full-txt/) |
| agent-readiness | Per-page Markdown source endpoints | recommended | [↗](https://specification.website/spec/agent-readiness/markdown-source-endpoints/) |
| agent-readiness | robots.txt for AI crawlers | recommended | [↗](https://specification.website/spec/agent-readiness/robots-for-ai-crawlers/) |
| agent-readiness | Content Signals in robots.txt | optional | [↗](https://specification.website/spec/agent-readiness/content-signals/) |
| agent-readiness | Web Bot Auth — verifiable bot identity | optional | [↗](https://specification.website/spec/agent-readiness/web-bot-auth/) |
| agent-readiness | Stable URLs | required | [↗](https://specification.website/spec/agent-readiness/stable-urls/) |
| agent-readiness | Structured data for agents | recommended | [↗](https://specification.website/spec/agent-readiness/structured-data-for-agents/) |
| agent-readiness | Machine-readable formats | recommended | [↗](https://specification.website/spec/agent-readiness/machine-readable-formats/) |
| agent-readiness | HTTP Link headers for discovery | recommended | [↗](https://specification.website/spec/agent-readiness/link-headers/) |
| agent-readiness | MCP and tool discovery | optional | [↗](https://specification.website/spec/agent-readiness/mcp-and-tool-discovery/) |
| agent-readiness | A2A agent cards | optional | [↗](https://specification.website/spec/agent-readiness/a2a-agent-cards/) |
| agent-readiness | Agent Skills discovery | recommended | [↗](https://specification.website/spec/agent-readiness/agent-skills-discovery/) |
| agent-readiness | DNS for AI Discovery (DNS-AID) | optional | [↗](https://specification.website/spec/agent-readiness/dns-aid/) |
| agent-readiness | NLWeb — conversational interface discovery | optional | [↗](https://specification.website/spec/agent-readiness/nlweb/) |
| agent-readiness | WebMCP — browser-native tools for agents | optional | [↗](https://specification.website/spec/agent-readiness/webmcp/) |
| agent-readiness | Schemamap — discoverable JSON-LD endpoints per resource | optional | [↗](https://specification.website/spec/agent-readiness/schemamap/) |
| performance | Core Web Vitals (LCP, INP, CLS) | required | [↗](https://specification.website/spec/performance/core-web-vitals/) |
| performance | Image optimisation | required | [↗](https://specification.website/spec/performance/image-optimization/) |
| performance | Lazy loading images, iframes, and video | recommended | [↗](https://specification.website/spec/performance/lazy-loading/) |
| performance | Preload, prefetch, preconnect | recommended | [↗](https://specification.website/spec/performance/preload-prefetch-preconnect/) |
| performance | Cache-Control headers | required | [↗](https://specification.website/spec/performance/cache-control/) |
| performance | Conditional requests (ETag, Last-Modified, 304) | recommended | [↗](https://specification.website/spec/performance/conditional-requests/) |
| performance | No-Vary-Search response header | recommended | [↗](https://specification.website/spec/performance/no-vary-search/) |
| performance | Compression (gzip, brotli, zstd) | required | [↗](https://specification.website/spec/performance/compression/) |
| performance | Web font loading | recommended | [↗](https://specification.website/spec/performance/font-loading/) |
| performance | Critical CSS and render-blocking resources | recommended | [↗](https://specification.website/spec/performance/critical-css/) |
| performance | Script loading — defer, async, module | recommended | [↗](https://specification.website/spec/performance/script-loading/) |
| performance | HTTP/2 and HTTP/3 | recommended | [↗](https://specification.website/spec/performance/http3/) |
| performance | Speculation Rules | recommended | [↗](https://specification.website/spec/performance/speculation-rules/) |
| performance | Resource hints overview | recommended | [↗](https://specification.website/spec/performance/resource-hints/) |
| performance | View Transitions | recommended | [↗](https://specification.website/spec/performance/view-transitions/) |
| performance | Back/forward cache (BFCache) | recommended | [↗](https://specification.website/spec/performance/bfcache/) |
| performance | Visibility-aware rendering | recommended | [↗](https://specification.website/spec/performance/visibility-aware-rendering/) |
| performance | CSS containment | optional | [↗](https://specification.website/spec/performance/css-containment/) |
| performance | Scroll-driven animations | optional | [↗](https://specification.website/spec/performance/scroll-driven-animations/) |
| performance | Scrollbar gutter | recommended | [↗](https://specification.website/spec/performance/scrollbar-gutter/) |
| performance | Dynamic viewport units (dvh, svh, lvh) | recommended | [↗](https://specification.website/spec/performance/dynamic-viewport-units/) |
| privacy | Privacy policy | required | [↗](https://specification.website/spec/privacy/privacy-policy/) |
| privacy | Cookie consent | required | [↗](https://specification.website/spec/privacy/cookie-consent/) |
| privacy | Global Privacy Control (GPC) | recommended | [↗](https://specification.website/spec/privacy/global-privacy-control/) |
| privacy | Third-party scripts and privacy | recommended | [↗](https://specification.website/spec/privacy/third-party-scripts/) |
| privacy | Privacy-respecting analytics | recommended | [↗](https://specification.website/spec/privacy/analytics-privacy/) |
| privacy | Data minimisation | recommended | [↗](https://specification.website/spec/privacy/data-minimization/) |
| resilience | Custom error pages (404, 500) | required | [↗](https://specification.website/spec/resilience/error-pages/) |
| resilience | Maintenance pages and 503 | recommended | [↗](https://specification.website/spec/resilience/maintenance-pages/) |
| resilience | Graceful degradation when JavaScript fails | recommended | [↗](https://specification.website/spec/resilience/graceful-degradation/) |
| resilience | Offline support and service workers | optional | [↗](https://specification.website/spec/resilience/offline-support/) |
| resilience | Web app manifest | recommended | [↗](https://specification.website/spec/resilience/pwa-manifest/) |
| resilience | Monitoring and uptime | recommended | [↗](https://specification.website/spec/resilience/monitoring-uptime/) |
| i18n | International URL structure | recommended | [↗](https://specification.website/spec/i18n/international-url-structure/) |
| i18n | hreflang for language and regional URLs | recommended | [↗](https://specification.website/spec/i18n/hreflang/) |
| i18n | Localised page metadata | recommended | [↗](https://specification.website/spec/i18n/localised-metadata/) |
| i18n | hreflang in XML sitemaps | optional | [↗](https://specification.website/spec/i18n/sitemap-hreflang/) |
| i18n | lang attribute on inline content | required | [↗](https://specification.website/spec/i18n/lang-attribute/) |
| i18n | Language switcher | recommended | [↗](https://specification.website/spec/i18n/language-switcher/) |
| i18n | RTL and bidirectional text | recommended | [↗](https://specification.website/spec/i18n/rtl-support/) |
| i18n | Writing modes and CJK line breaking | optional | [↗](https://specification.website/spec/i18n/writing-modes/) |
| i18n | Locale-aware content | recommended | [↗](https://specification.website/spec/i18n/locale-content/) |
| i18n | Plural rules and grammatical number | recommended | [↗](https://specification.website/spec/i18n/plural-rules/) |
| i18n | Internationalised Domain Names (IDN) | optional | [↗](https://specification.website/spec/i18n/idn-support/) |

</details>

---

## Findings by Category

### Foundations — 8 pass · 0 fail · 6 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| The HTML doctype [spec ↗](https://specification.website/spec/foundations/doctype/) | ✅ Pass | — | HTML5 <!doctype html> present |
| The lang attribute on <html> [spec ↗](https://specification.website/spec/foundations/html-lang/) | ✅ Pass | — | lang="en" found on <html> |
| <meta charset> [spec ↗](https://specification.website/spec/foundations/meta-charset/) | ✅ Pass | — | Charset declared: utf-8 |
| <meta viewport> [spec ↗](https://specification.website/spec/foundations/meta-viewport/) | ✅ Pass | — | <meta name="viewport"> found |
| The <title> element [spec ↗](https://specification.website/spec/foundations/title/) | ✅ Pass | — | Non-empty <title> element found |
| <meta name="description"> [spec ↗](https://specification.website/spec/foundations/meta-description/) | ✅ Pass | — | Non-empty <meta name="description"> found |
| Canonical URL (rel="canonical") [spec ↗](https://specification.website/spec/foundations/canonical-url/) | ⚠️ Review | — | _Home-page HTML not fetched_ |
| Favicons and app icons [spec ↗](https://specification.website/spec/foundations/favicons/) | ✅ Pass | — | Favicon / app-icon link element found |
| <meta name="theme-color"> [spec ↗](https://specification.website/spec/foundations/theme-color/) | ⚠️ Review | — | _No <meta name="theme-color"> on home page — optional; sets the browser UI colour on mobile_ |
| <meta name="color-scheme"> [spec ↗](https://specification.website/spec/foundations/color-scheme/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Open Graph protocol [spec ↗](https://specification.website/spec/foundations/open-graph/) | ✅ Pass | — | Open Graph meta tags found |
| Feed discovery with rel="alternate" [spec ↗](https://specification.website/spec/foundations/feed-discovery/) | ⚠️ Review | — | _No <link rel="alternate"> RSS/Atom/JSON feed on home page — only needed if the site publishes a feed_ |
| Feed content hygiene [spec ↗](https://specification.website/spec/foundations/feed-hygiene/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Popover API [spec ↗](https://specification.website/spec/foundations/popover-api/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |

### Seo — 6 pass · 0 fail · 7 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| robots.txt [spec ↗](https://specification.website/spec/seo/robots-txt/) | ✅ Pass | — | robots.txt present and accessible |
| XML sitemaps [spec ↗](https://specification.website/spec/seo/xml-sitemaps/) | ✅ Pass | — | Sitemap present (25 URL entries) |
| Sitemap index files [spec ↗](https://specification.website/spec/seo/sitemap-index/) | ⚠️ Review | — | _Sitemap index not detected; may not be required depending on site size_ |
| Image and video sitemap extensions [spec ↗](https://specification.website/spec/seo/image-sitemaps/) | ⚠️ Review | — | _No image entries in the sitemap — optional; add <image:image> if image search traffic matters_ |
| URL structure [spec ↗](https://specification.website/spec/seo/url-structure/) | ⚠️ Review | — | _URL structure requires a full crawl (run with --crawl or --load-crawl)_ |
| Redirects (301/302/308) [spec ↗](https://specification.website/spec/seo/redirects/) | ✅ Pass | — | HTTP→HTTPS redirect confirmed (final URL: https://rvajames.org/) |
| Server-side rendering [spec ↗](https://specification.website/spec/seo/server-side-rendering/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Meta robots and X-Robots-Tag [spec ↗](https://specification.website/spec/seo/meta-robots/) | ✅ Pass | — | No restrictive <meta name="robots"> on home page (defaults to indexable) |
| Heading hierarchy [spec ↗](https://specification.website/spec/seo/heading-hierarchy/) | ✅ Pass | — | Single <h1> and no skipped heading levels on home page |
| Internal linking [spec ↗](https://specification.website/spec/seo/internal-linking/) | ⚠️ Review | — | _Internal linking requires a full crawl with inlink data (run with --crawl or --load-crawl)_ |
| Structured data (JSON-LD) [spec ↗](https://specification.website/spec/seo/structured-data/) | ✅ Pass | — | JSON-LD found: Organization, WebSite |
| Breadcrumbs [spec ↗](https://specification.website/spec/seo/breadcrumbs/) | ⚠️ Review | — | _BreadcrumbList not found on home page — check interior pages manually_ |
| IndexNow [spec ↗](https://specification.website/spec/seo/indexnow/) | ⚠️ Review | — | _IndexNow detection requires per-URL check not yet implemented_ |

### Accessibility — 15 pass · 0 fail · 4 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| Colour contrast [spec ↗](https://specification.website/spec/accessibility/color-contrast/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Image alt text [spec ↗](https://specification.website/spec/accessibility/image-alt-text/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Form labels [spec ↗](https://specification.website/spec/accessibility/form-labels/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Keyboard navigation [spec ↗](https://specification.website/spec/accessibility/keyboard-navigation/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Visible focus indicators [spec ↗](https://specification.website/spec/accessibility/focus-indicators/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Skip links [spec ↗](https://specification.website/spec/accessibility/skip-links/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Semantic HTML and landmarks [spec ↗](https://specification.website/spec/accessibility/semantic-html/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| ARIA — first rule of ARIA [spec ↗](https://specification.website/spec/accessibility/aria-usage/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Descriptive link text [spec ↗](https://specification.website/spec/accessibility/link-text/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Accessible form errors [spec ↗](https://specification.website/spec/accessibility/form-errors/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Document and parts language [spec ↗](https://specification.website/spec/accessibility/document-language/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Reduced motion [spec ↗](https://specification.website/spec/accessibility/reduced-motion/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Captions and transcripts [spec ↗](https://specification.website/spec/accessibility/captions-and-transcripts/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Accessible data tables [spec ↗](https://specification.website/spec/accessibility/data-tables/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Touch target size [spec ↗](https://specification.website/spec/accessibility/touch-target-size/) | ✅ Pass | — | No violations found for this criterion via pa11y-axe |
| Hidden until found [spec ↗](https://specification.website/spec/accessibility/hidden-until-found/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Mobile-friendly form inputs [spec ↗](https://specification.website/spec/accessibility/mobile-form-inputs/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Native interactive elements [spec ↗](https://specification.website/spec/accessibility/native-interactive-elements/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| CSS state and relational selectors [spec ↗](https://specification.website/spec/accessibility/css-state-selectors/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |

### Security — 8 pass · 3 fail · 2 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| HTTPS and TLS [spec ↗](https://specification.website/spec/security/https-tls/) | ✅ Pass | — | TLS version: TLSv1.3 — cert expires in 70d |
| HSTS (Strict-Transport-Security) [spec ↗](https://specification.website/spec/security/hsts/) | ✅ Pass | — | Strict-Transport-Security: max-age=31536000 (365 days, ≥ 180-day minimum); includeSubDomains — consider adding preload |
| Mixed content and upgrade-insecure-requests [spec ↗](https://specification.website/spec/security/mixed-content/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Content Security Policy (CSP) [spec ↗](https://specification.website/spec/security/content-security-policy/) | ❌ Fail | 🟡 Medium | Content-Security-Policy present but weak: script source allo… _(details in Prioritized Recommendations)_ |
| /.well-known/security.txt [spec ↗](https://specification.website/spec/security/security-txt/) | ✅ Pass | — | /.well-known/security.txt present |
| X-Content-Type-Options: nosniff [spec ↗](https://specification.website/spec/security/x-content-type-options/) | ✅ Pass | — | X-Content-Type-Options: nosniff |
| Clickjacking protection (frame-ancestors / X-Frame-Options) [spec ↗](https://specification.website/spec/security/frame-ancestors/) | ✅ Pass | — | CSP frame-ancestors restricts framing: 'none' |
| Referrer-Policy [spec ↗](https://specification.website/spec/security/referrer-policy/) | ✅ Pass | — | Referrer-Policy: strict-origin-when-cross-origin (effective: strict-origin-when-cross-origin) |
| Permissions-Policy [spec ↗](https://specification.website/spec/security/permissions-policy/) | ✅ Pass | — | Permissions-Policy restricts features: camera=(), microphone=(), geolocation=() |
| Subresource Integrity (SRI) [spec ↗](https://specification.website/spec/security/subresource-integrity/) | ✅ Pass | — | All 1 cross-origin subresource(s) carry integrity attributes |
| Cookie attributes — Secure, HttpOnly, SameSite [spec ↗](https://specification.website/spec/security/cookie-attributes/) | ⚠️ Review | — | _No Set-Cookie headers on the home page — cookies are often only set on authenticated or interior pages; review those manually_ |
| DNS CAA records [spec ↗](https://specification.website/spec/security/caa-records/) | ❌ Fail | 🟡 Medium | No CAA records found for rvajames.org… _(details in Prioritized Recommendations)_ |
| DNSSEC [spec ↗](https://specification.website/spec/security/dnssec/) | ❌ Fail | 🔵 Low | No DNSSEC validation for rvajames.org (resolver did not set … _(details in Prioritized Recommendations)_ |

### Well-known — 1 pass · 0 fail · 7 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| Well-known URIs [spec ↗](https://specification.website/spec/well-known/well-known-overview/) | ✅ Pass | — | 2 well-known endpoint(s) detected: security.txt, llms.txt |
| /.well-known/webauthn [spec ↗](https://specification.website/spec/well-known/webauthn/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| /.well-known/api-catalog [spec ↗](https://specification.website/spec/well-known/api-catalog/) | ⚠️ Review | — | _Not found — only needed if the host exposes public APIs to catalogue (RFC 9727)_ |
| /.well-known/webfinger [spec ↗](https://specification.website/spec/well-known/webfinger/) | ⚠️ Review | — | _Not found — only needed for Fediverse/ActivityPub account discovery_ |
| /.well-known/apple-app-site-association [spec ↗](https://specification.website/spec/well-known/apple-app-site-association/) | ⚠️ Review | — | _Not found — only needed if you ship an iOS/macOS app using Universal Links_ |
| /.well-known/assetlinks.json [spec ↗](https://specification.website/spec/well-known/assetlinks-json/) | ⚠️ Review | — | _Not found — only needed if you ship an Android app using App Links_ |
| /.well-known/nodeinfo [spec ↗](https://specification.website/spec/well-known/nodeinfo/) | ⚠️ Review | — | _Not found — only relevant for federated/ActivityPub servers_ |
| /.well-known/traffic-advice [spec ↗](https://specification.website/spec/well-known/traffic-advice/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |

### Agent-readiness — 6 pass · 0 fail · 12 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| Agent readiness [spec ↗](https://specification.website/spec/agent-readiness/agent-readiness-overview/) | ⚠️ Review | — | _Agent readiness overview — review the full category manually_ |
| /llms.txt [spec ↗](https://specification.website/spec/agent-readiness/llms-txt/) | ✅ Pass | — | /llms.txt present |
| /llms-full.txt [spec ↗](https://specification.website/spec/agent-readiness/llms-full-txt/) | ⚠️ Review | — | _/llms-full.txt not found — optional companion to /llms.txt; useful for small sites, costly for large ones_ |
| Per-page Markdown source endpoints [spec ↗](https://specification.website/spec/agent-readiness/markdown-source-endpoints/) | ⚠️ Review | — | _Markdown endpoint detection requires per-page link analysis_ |
| robots.txt for AI crawlers [spec ↗](https://specification.website/spec/agent-readiness/robots-for-ai-crawlers/) | ✅ Pass | — | AI crawler rules found in robots.txt |
| Content Signals in robots.txt [spec ↗](https://specification.website/spec/agent-readiness/content-signals/) | ✅ Pass | — | Content-Signal directives present in robots.txt |
| Web Bot Auth — verifiable bot identity [spec ↗](https://specification.website/spec/agent-readiness/web-bot-auth/) | ⚠️ Review | — | _Web bot auth requires auth flow testing_ |
| Stable URLs [spec ↗](https://specification.website/spec/agent-readiness/stable-urls/) | ⚠️ Review | — | _Stable URL verification requires crawl history comparison_ |
| Structured data for agents [spec ↗](https://specification.website/spec/agent-readiness/structured-data-for-agents/) | ✅ Pass | — | Structured data found: Organization, WebSite |
| Machine-readable formats [spec ↗](https://specification.website/spec/agent-readiness/machine-readable-formats/) | ✅ Pass | — | Machine-readable formats offered: JSON-LD structured data, /llms.txt |
| HTTP Link headers for discovery [spec ↗](https://specification.website/spec/agent-readiness/link-headers/) | ✅ Pass | — | Link header present: </_next/static/media/68180864d7f93f02-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="fon |
| MCP and tool discovery [spec ↗](https://specification.website/spec/agent-readiness/mcp-and-tool-discovery/) | ⚠️ Review | — | _No /.well-known/mcp.json or MCP Link header — optional; expose MCP tools if your content has queryable structure_ |
| A2A agent cards [spec ↗](https://specification.website/spec/agent-readiness/a2a-agent-cards/) | ⚠️ Review | — | _/.well-known/agent-card.json not found — only needed if your service exposes agentic behaviour for A2A delegation_ |
| Agent Skills discovery [spec ↗](https://specification.website/spec/agent-readiness/agent-skills-discovery/) | ⚠️ Review | — | _Agent skills discovery requires endpoint analysis_ |
| DNS for AI Discovery (DNS-AID) [spec ↗](https://specification.website/spec/agent-readiness/dns-aid/) | ⚠️ Review | — | _No _agents.rvajames.org SVCB/HTTPS record — emerging DNS-AID convention, optional_ |
| NLWeb — conversational interface discovery [spec ↗](https://specification.website/spec/agent-readiness/nlweb/) | ⚠️ Review | — | _No <link rel="nlweb"> on home page — emerging conversational-interface convention, optional_ |
| WebMCP — browser-native tools for agents [spec ↗](https://specification.website/spec/agent-readiness/webmcp/) | ⚠️ Review | — | _No navigator.modelContext (WebMCP) API exposed on the home page — emerging agent-interface convention, optional_ |
| Schemamap — discoverable JSON-LD endpoints per resource [spec ↗](https://specification.website/spec/agent-readiness/schemamap/) | ⚠️ Review | — | _No /schemamap.xml or <link rel="schemamap"> — emerging convention proposed by the spec, optional_ |

### Performance — 9 pass · 0 fail · 12 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| Core Web Vitals (LCP, INP, CLS) [spec ↗](https://specification.website/spec/performance/core-web-vitals/) | ✅ Pass | — | Core Web Vitals in the "good" range — LCP 2164ms, CLS 0, TBT 58ms (median of 3 lab runs; perf score 99/100) |
| Image optimisation [spec ↗](https://specification.website/spec/performance/image-optimization/) | ⚠️ Review | — | _Image optimisation requires a full crawl (run with --crawl or --load-crawl)_ |
| Lazy loading images, iframes, and video [spec ↗](https://specification.website/spec/performance/lazy-loading/) | ✅ Pass | — | No <img>/<iframe> on home page to lazy-load |
| Preload, prefetch, preconnect [spec ↗](https://specification.website/spec/performance/preload-prefetch-preconnect/) | ✅ Pass | — | Link header includes preload/preconnect hints: </_next/static/media/68180864d7f93f02-s.p.woff2>; rel=preload; as="font"; |
| Cache-Control headers [spec ↗](https://specification.website/spec/performance/cache-control/) | ✅ Pass | — | Cache-Control: public, s-maxage=60, stale-while-revalidate=300 |
| Conditional requests (ETag, Last-Modified, 304) [spec ↗](https://specification.website/spec/performance/conditional-requests/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| No-Vary-Search response header [spec ↗](https://specification.website/spec/performance/no-vary-search/) | ⚠️ Review | — | _No-Vary-Search header absent — may not be required depending on URL parameterisation strategy_ |
| Compression (gzip, brotli, zstd) [spec ↗](https://specification.website/spec/performance/compression/) | ✅ Pass | — | Content-Encoding: zstd |
| Web font loading [spec ↗](https://specification.website/spec/performance/font-loading/) | ⚠️ Review | — | _Lighthouse did not report the font-display audit (no web fonts detected?)_ |
| Critical CSS and render-blocking resources [spec ↗](https://specification.website/spec/performance/critical-css/) | ✅ Pass | — | No render-blocking resources flagged |
| Script loading — defer, async, module [spec ↗](https://specification.website/spec/performance/script-loading/) | ✅ Pass | — | All 1 external script(s) on the home page use async/defer/module |
| HTTP/2 and HTTP/3 [spec ↗](https://specification.website/spec/performance/http3/) | ✅ Pass | — | Alt-Svc: h3=":443"; ma=86400 (HTTP/3 advertised) |
| Speculation Rules [spec ↗](https://specification.website/spec/performance/speculation-rules/) | ⚠️ Review | — | _No speculation rules on home page — optional progressive enhancement for prefetch/prerender_ |
| Resource hints overview [spec ↗](https://specification.website/spec/performance/resource-hints/) | ✅ Pass | — | Resource hints in HTML <link>: preload, preconnect, dnsPrefetch |
| View Transitions [spec ↗](https://specification.website/spec/performance/view-transitions/) | ⚠️ Review | — | _No view-transition opt-in meta on home page — optional; CSS/JS view transitions can't be detected from static HTML_ |
| Back/forward cache (BFCache) [spec ↗](https://specification.website/spec/performance/bfcache/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Visibility-aware rendering [spec ↗](https://specification.website/spec/performance/visibility-aware-rendering/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| CSS containment [spec ↗](https://specification.website/spec/performance/css-containment/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Scroll-driven animations [spec ↗](https://specification.website/spec/performance/scroll-driven-animations/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Scrollbar gutter [spec ↗](https://specification.website/spec/performance/scrollbar-gutter/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Dynamic viewport units (dvh, svh, lvh) [spec ↗](https://specification.website/spec/performance/dynamic-viewport-units/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |

### Privacy — 1 pass · 1 fail · 4 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| Privacy policy [spec ↗](https://specification.website/spec/privacy/privacy-policy/) | ⚠️ Review | — | _Privacy policy detection requires content/link analysis_ |
| Cookie consent [spec ↗](https://specification.website/spec/privacy/cookie-consent/) | ❌ Fail | 🔴 High | No cookie-consent mechanism detected, yet the page loads 1 t… _(details in Prioritized Recommendations)_ |
| Global Privacy Control (GPC) [spec ↗](https://specification.website/spec/privacy/global-privacy-control/) | ⚠️ Review | — | _Global Privacy Control respect requires server-side code review — cannot be detected from headers alone (Permissions-Policy header present: camera=(), microphone=(), geolocation=())_ |
| Third-party scripts and privacy [spec ↗](https://specification.website/spec/privacy/third-party-scripts/) | ✅ Pass | — | 1 third-party script origin(s) loaded at runtime (https://static.cloudflareinsights.com) — a modest, reviewable surface |
| Privacy-respecting analytics [spec ↗](https://specification.website/spec/privacy/analytics-privacy/) | ⚠️ Review | — | _Analytics privacy requires configuration review_ |
| Data minimisation [spec ↗](https://specification.website/spec/privacy/data-minimization/) | ⚠️ Review | — | _Data minimisation requires data flow analysis_ |

### Resilience — 1 pass · 0 fail · 5 manual review

| Item | Status | Severity | Evidence / Note |
| --- | --- | --- | --- |
| Custom error pages (404, 500) [spec ↗](https://specification.website/spec/resilience/error-pages/) | ✅ Pass | — | Missing pages return HTTP 404 with a branded custom error page (14,732 bytes) |
| Maintenance pages and 503 [spec ↗](https://specification.website/spec/resilience/maintenance-pages/) | ⚠️ Review | — | _Maintenance page detection requires infrastructure review_ |
| Graceful degradation when JavaScript fails [spec ↗](https://specification.website/spec/resilience/graceful-degradation/) | ⚠️ Review | — | _No automated check exists for this spec item yet — assess it manually against the spec._ |
| Offline support and service workers [spec ↗](https://specification.website/spec/resilience/offline-support/) | ⚠️ Review | — | _No service worker registered at runtime — offline support is optional for most marketing sites, so review only if a PWA/offline experience is expected_ |
| Web app manifest [spec ↗](https://specification.website/spec/resilience/pwa-manifest/) | ⚠️ Review | — | _No <link rel="manifest"> or reachable /manifest.json — optional unless the site is an installable PWA_ |
| Monitoring and uptime [spec ↗](https://specification.website/spec/resilience/monitoring-uptime/) | ⚠️ Review | — | _Uptime monitoring requires infrastructure review_ |

---

## N/A / Out-of-Scope Items

_These spec items were excluded based on the site profile. Each exclusion is traceable to a specific profile field._

| Item | Category | Reason |
| --- | --- | --- |
| /.well-known/change-password | well-known | profile: hasAuthAccounts=false — no authenticated user accounts on this site |
| /.well-known/openid-configuration | well-known | profile: hasAuthAccounts=false — no OAuth / OpenID Connect flow on this site |
| International URL structure | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| hreflang for language and regional URLs | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| Localised page metadata | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| hreflang in XML sitemaps | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| lang attribute on inline content | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| Language switcher | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| RTL and bidirectional text | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| Writing modes and CJK line breaking | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| Locale-aware content | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| Plural rules and grammatical number | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |
| Internationalised Domain Names (IDN) | i18n | profile: localeScope=single — site does not serve multiple locales; all internationalisation requirements are out of scope |

---

## Deprioritised Items

_These spec items were still evaluated, but ranked down based on the site profile. Each deprioritisation is traceable to a specific profile field._

| Item | Category | Outcome | Reason |
| --- | --- | --- | --- |
| /.well-known/webfinger [spec ↗](https://specification.website/spec/well-known/webfinger/) | well-known | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| /.well-known/nodeinfo [spec ↗](https://specification.website/spec/well-known/nodeinfo/) | well-known | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| MCP and tool discovery [spec ↗](https://specification.website/spec/agent-readiness/mcp-and-tool-discovery/) | agent-readiness | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| A2A agent cards [spec ↗](https://specification.website/spec/agent-readiness/a2a-agent-cards/) | agent-readiness | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| DNS for AI Discovery (DNS-AID) [spec ↗](https://specification.website/spec/agent-readiness/dns-aid/) | agent-readiness | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| NLWeb — conversational interface discovery [spec ↗](https://specification.website/spec/agent-readiness/nlweb/) | agent-readiness | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| WebMCP — browser-native tools for agents [spec ↗](https://specification.website/spec/agent-readiness/webmcp/) | agent-readiness | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| Schemamap — discoverable JSON-LD endpoints per resource [spec ↗](https://specification.website/spec/agent-readiness/schemamap/) | agent-readiness | ⚠️ Review | profile: siteType=marketing — niche agent/discovery protocols add low incremental value on brochure sites; revisit if agent integrations become a goal |
| Offline support and service workers [spec ↗](https://specification.website/spec/resilience/offline-support/) | resilience | ⚠️ Review | profile: siteType=marketing — offline/PWA capability is rarely expected of brochure sites; revisit if an app-like experience is planned |
| Web app manifest [spec ↗](https://specification.website/spec/resilience/pwa-manifest/) | resilience | ⚠️ Review | profile: siteType=marketing — offline/PWA capability is rarely expected of brochure sites; revisit if an app-like experience is planned |

---

## Prioritized Recommendations

### High Priority

**1. Cookie consent**

- **Issue:** No cookie-consent mechanism detected, yet the page loads 1 third-party script origin(s) _(browser)_
- **Fix:** Add a consent banner / CMP before setting non-essential cookies or loading third-party trackers (GDPR/ePrivacy)
- **Spec:** [https://specification.website/spec/privacy/cookie-consent/](https://specification.website/spec/privacy/cookie-consent/)
- **Source:** spec-check run `2026-06-12T02-34-22-Z`, 11 June 2026

### Medium Priority

**2. Content Security Policy (CSP)**

- **Issue:** Content-Security-Policy present but weak: script source allows 'unsafe-inline' without nonce/hash (default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflarei…) _(headers)_
- **Fix:** Remove 'unsafe-inline'/'unsafe-eval' from script-src; use nonces or hashes and an explicit script-src allowlist
- **Spec:** [https://specification.website/spec/security/content-security-policy/](https://specification.website/spec/security/content-security-policy/)
- **Source:** spec-check run `2026-06-12T02-34-22-Z`, 11 June 2026

**3. DNS CAA records**

- **Issue:** No CAA records found for rvajames.org _(dns)_
- **Fix:** Add CAA records (e.g. 0 issue "letsencrypt.org") to restrict which CAs may issue certs
- **Spec:** [https://specification.website/spec/security/caa-records/](https://specification.website/spec/security/caa-records/)
- **Source:** spec-check run `2026-06-12T02-34-22-Z`, 11 June 2026

### Low Priority

**4. DNSSEC**

- **Issue:** No DNSSEC validation for rvajames.org (resolver did not set the AD flag) _(dns)_
- **Fix:** Enable DNSSEC signing at your DNS provider and add the DS record at the registrar
- **Spec:** [https://specification.website/spec/security/dnssec/](https://specification.website/spec/security/dnssec/)
- **Source:** spec-check run `2026-06-12T02-34-22-Z`, 11 June 2026
