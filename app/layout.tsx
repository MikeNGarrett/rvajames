import type { Metadata } from 'next';
import { Nunito_Sans } from 'next/font/google';
import './globals.css';

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-nunito-sans',
  /**
   * Finding 14 — font-display: optional vs swap.
   * 'optional' means: use the font only if it's already cached or loads within
   * the first 100ms. On a cache hit (every return visit, all Cloudflare-cached
   * requests) the font appears immediately with zero FOUT or CLS.
   * On a cold first visit over a slow connection, the system fallback is used —
   * no layout shift, no flash. This is strictly better for CLS than 'swap'.
   */
  display: 'optional',
});

export const metadata: Metadata = {
  title: 'RVA James — James River Family Dashboard',
  description:
    'Richmond family guide to the James River: conditions, access points, and activity recommendations.',
  metadataBase: new URL('https://rvajames.org'),
  openGraph: {
    siteName:    'RVA James',
    type:        'website',
    url:         'https://rvajames.org',
    title:       'RVA James — James River Family Dashboard',
    description: 'Richmond family guide to the James River: conditions, access points, and activity recommendations.',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'RVA James — James River Family Dashboard',
    description: 'Richmond family guide to the James River: conditions, access points, and activity recommendations.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunitoSans.variable}>
      <head>
        {/*
         * Finding 10 — Cloudflare Web Analytics beacon preconnect.
         * Cloudflare injects beacon.min.js from static.cloudflareinsights.com at
         * the edge. The preconnect hint opens the TCP+TLS connection early so the
         * script load doesn't pay a full round-trip penalty on first render.
         * The RUM endpoint is on cloudflareinsights.com (no "static." subdomain).
         */}
        <link rel="preconnect" href="https://static.cloudflareinsights.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cloudflareinsights.com" />

        {/*
         * Spec audit E — JSON-LD structured data.
         *
         * Two schemas combined into a single @graph payload:
         *   - Organization: the publisher entity (RVA James)
         *   - WebSite: this site itself, referencing the Organization
         *     via @id so crawlers see the publisher/site relationship
         *
         * Closes three spec-website findings in one shot:
         *   - SEO → Structured data (JSON-LD)
         *   - Agent-readiness → Structured data for agents
         *   - Agent-readiness → Machine-readable formats (alongside /llms.txt)
         *
         * Per-page schemas (e.g. Place for /locations/[slug]) can layer on
         * the same @graph in their own route metadata later. Out of scope
         * for this round.
         */}
        <script
          type="application/ld+json"
          // dangerouslySetInnerHTML is the canonical Next.js pattern for
          // emitting raw JSON-LD; React's normal child rendering would
          // escape the JSON characters.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph':   [
                {
                  '@type': 'Organization',
                  '@id':   'https://rvajames.org/#org',
                  name:    'RVA James',
                  url:     'https://rvajames.org/',
                  logo:    'https://rvajames.org/icon',
                },
                {
                  '@type':    'WebSite',
                  '@id':      'https://rvajames.org/#site',
                  url:        'https://rvajames.org/',
                  name:       'RVA James — James River Family Dashboard',
                  description:
                    'Richmond family guide to the James River: conditions, access points, and activity recommendations.',
                  inLanguage: 'en',
                  publisher:  { '@id': 'https://rvajames.org/#org' },
                },
              ],
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
