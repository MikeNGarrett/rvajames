import type { Metadata } from 'next';
import Link from 'next/link';
import { DisclaimerFooter } from '@/components/legal/DisclaimerFooter';
import { PageContainer } from '@/components/ui/PageContainer';

/**
 * /about — project intent + creator bio + "how it's built" overview.
 *
 * Last static page in the original plan. Mirrors /safety's structural
 * conventions (Back link, h1, intro paragraph, sectioned content,
 * DisclaimerFooter) for visual consistency.
 *
 * Sections
 *   1. What RVA James is — short framing of the project's purpose.
 *      Reinforces the AI-disclosure posture from /safety + DisclaimerFooter.
 *   2. About the creator — verbatim bio paragraph(s) supplied by the user
 *      2026-06-04 via /about kickoff Q&A. NOT to be paraphrased.
 *   3. How it's built — 3-sentence plain-language overview for general
 *      readers, followed by a collapsible <details> block ("For the
 *      technically curious") that surfaces the actual stack details.
 *      Per the audit's "How it's built" guidance, sidebar covers cron
 *      schedule, prompt caching, freshness model — enough depth for an
 *      engineer to evaluate the project without dominating the page.
 *
 * Navigation
 *   Reachable via:
 *   - "Learn more →" link appended to the homepage tagline
 *   - "About" link in DisclaimerFooter (every page)
 *   - sitemap.ts (added in the same commit)
 */

export const metadata: Metadata = {
  title: 'About — RVA James',
  description:
    'About RVA James — a Richmond parent\'s passion project bringing James River conditions, ' +
    'trail info, and family-friendly guides together in one place.',
};

const REPO_URL = 'https://github.com/MikeNGarrett/rvajames';

export default function AboutPage() {
  return (
    <main>
      <PageContainer className="py-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-rva-blue mb-4 touch-target"
        >
          ← Back to dashboard
        </Link>

        <h1 className="text-2xl font-extrabold text-text mb-2">About RVA James</h1>
        <p className="text-text-secondary text-sm mb-6 max-w-prose">
          A passion project bringing James River conditions, trail info, and family-friendly
          guides together in one place.
        </p>

        <section className="mb-8 max-w-prose">
          <h2 className="text-lg font-semibold text-text mb-3">What this is</h2>
          <div className="space-y-3 text-sm text-text leading-relaxed">
            <p>
              RVA James is an independent dashboard that pulls together river conditions,
              flood and water-quality advisories, weather, and combined-sewer-overflow status
              for the James River around Richmond — and translates them into plain-language
              guidance for families with kids.
            </p>
            <p>
              All of the underlying data already exists across USGS, NWS, the James River
              Association, and Richmond DPU. The goal here is to consolidate it, age-tune the
              recommendations, and be honest about uncertainty. The site uses AI to interpret
              sensor data into readable guidance — never to make safety decisions for you.
              Always use your own judgment near the river.
            </p>
          </div>
        </section>

        <section className="mb-8 max-w-prose">
          <h2 className="text-lg font-semibold text-text mb-3">About the creator</h2>
          {/*
           * Bio prose is verbatim from the user, 2026-06-04. The h3
           * subhead and four paragraphs below preserve the original
           * structure; do not paraphrase.
           */}
          <div className="space-y-3 text-sm text-text leading-relaxed">
            <p>RVA James is a passion project by Mike Garrett.</p>
            <h3 className="text-base font-semibold text-text mt-4">About Mike</h3>
            <p>
              I moved to Richmond in 2016 and quickly discovered that the James River is one of
              the city&rsquo;s greatest assets. It&rsquo;s where my family hikes, swims, and
              spends time together throughout the year.
            </p>
            <p>
              As a parent, I found myself constantly searching for practical information:
              Which trails work for young kids? What does the river level actually mean? Which
              spots are crowded? Where can you safely explore, swim, paddle, or fish? The
              answers were often scattered across websites, maps, social media posts, and
              local knowledge.
            </p>
            <p>RVA James is my attempt to bring that information together in one place.</p>
            <p>
              I&rsquo;m not a riverkeeper, biologist, historian, or professional guide.
              I&rsquo;m a Richmond parent who enjoys researching the river and sharing what I
              learn. My goal is simple: help busy families spend less time searching for
              information and more time enjoying the James.
            </p>
            <p>
              This site is a collection of practical guides, local knowledge, river
              conditions, history, and family-friendly adventures gathered along the way.
              I&rsquo;m still learning, and RVA James is a record of that journey.
            </p>
          </div>
        </section>

        <section className="mb-8 max-w-prose">
          <h2 className="text-lg font-semibold text-text mb-3">How it&rsquo;s built</h2>
          <div className="space-y-3 text-sm text-text leading-relaxed">
            <p>
              RVA James is a Next.js app running on Cloudflare Workers, with data stored in
              Supabase (Postgres). Scheduled jobs pull from USGS, NWS, the James River
              Association, and Richmond DPU every 15 minutes to a few times a day. Claude
              (Anthropic&rsquo;s AI) interprets that stored data into family-readable
              guidance — it never fetches data itself.
            </p>
            <p>
              The source code is open:{' '}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rva-blue underline"
              >
                github.com/MikeNGarrett/rvajames<span className="sr-only"> (opens in new tab)</span>
              </a>
              .
            </p>
          </div>

          <details className="mt-4 rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-secondary">
            <summary className="cursor-pointer font-medium text-text">
              For the technically curious
            </summary>
            <div className="mt-3 space-y-3 leading-relaxed">
              <p>
                <strong className="text-text">Stack.</strong> Next.js 15 (App Router, React
                19), TypeScript end-to-end, Tailwind v4 (CSS-first <code>@theme</code>{' '}
                config), Cloudflare Workers via{' '}
                <a
                  href="https://opennext.js.org/cloudflare"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rva-blue underline"
                >
                  OpenNext for Cloudflare
                </a>
                . Supabase (Postgres + RLS) for storage and{' '}
                <code>@supabase/supabase-js</code> on both server and edge. Anthropic SDK
                directly — no LangChain.
              </p>
              <p>
                <strong className="text-text">Ingestion.</strong> Cloudflare Cron Triggers
                run per-source jobs:{' '}
                <code>*/15</code> for USGS (gage height, discharge, water temp),{' '}
                <code>0 *</code> for NWS hourly forecast and active alerts,{' '}
                <code>0 12</code> for daily James River Watch (E. coli + advisory),{' '}
                <code>0 6,18</code> for Richmond DPU&rsquo;s combined-sewer-overflow
                advisories, plus a real-time poll of EmNet&rsquo;s outfall sensors. Every run
                writes to an <code>ingestion_runs</code> table — visible at{' '}
                <Link href="/status" className="text-rva-blue underline">
                  /status
                </Link>
                .
              </p>
              <p>
                <strong className="text-text">AI interpretation.</strong> A
                deterministic rules engine handles every safety threshold (gage bands, water
                temp cutoffs, age-appropriate activity gates) so the AI never decides who can
                swim. Claude turns the resolved conditions into prose that fits the brand
                voice. The system prompt is large but cached (Anthropic prompt caching,
                ephemeral cache control) — the location encyclopedia, age guidance, and JSON
                schema all sit in the cached block; only the date, location, age bucket, and
                snapshot summary are uncached per call. A SHA-256 hash of those uncached
                inputs prevents regenerating an interpretation when nothing has changed.
              </p>
              <p>
                <strong className="text-text">Freshness model.</strong> Each source has a
                per-tile staleness threshold (USGS 30 min, NWS 90 min, JRA 26 h, CSO 14 h).
                Past those, the affected tile renders a Stale state rather than a stale value
                — better to show &ldquo;we&rsquo;re missing data&rdquo; than a number that
                isn&rsquo;t true anymore.
              </p>
              <p>
                <strong className="text-text">Safety posture.</strong> The site never
                recommends an activity it can&rsquo;t justify from sensor data, never
                personalizes financial or medical advice, and surfaces the underlying numbers
                so you can second-guess the prose. See the{' '}
                <Link href="/safety" className="text-rva-blue underline">
                  safety resources
                </Link>{' '}
                page for the AAP / NPS / USCG documents the thresholds are grounded in.
              </p>
            </div>
          </details>
        </section>

        <DisclaimerFooter />
      </PageContainer>
    </main>
  );
}
