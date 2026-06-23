import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Binds Cloudflare platform APIs during `next dev` so getCloudflareContext() works.
if (process.env.NODE_ENV !== 'production') {
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // forbidden() support for the /admin auth guard (SEC-1 follow-up):
    // throwing a Response from a Server Component render surfaces as a 500
    // error boundary; forbidden() renders app/forbidden.tsx with a real 403.
    authInterrupts: true,
  },

  // @cloudflare/puppeteer is a Cloudflare Workers-only package. Marking it as
  // a server external prevents Next.js from bundling it during `next build`
  // (which runs in Node.js and can't execute the Workers-specific module).
  // The actual Workers build (`pnpm build:cf`) uses esbuild, which handles
  // this correctly without the external hint.
  serverExternalPackages: ['@cloudflare/puppeteer'],

  // NOTE: the Next.js #89844 dev-overlay-leak webpack workaround was removed in
  // the Next 16 upgrade — Next 16 builds with Turbopack by default (a custom
  // webpack config now conflicts with the build), and the dev-tools bundling
  // that #89844 patched was reworked in 16. Verify the prod client bundle stays
  // free of next-devtools chunks after upgrading (the original regression was a
  // ~217 KB always-unused shared chunk); re-introduce a Turbopack-side guard if
  // it recurs.

  async headers() {
    return [
      {
        // Content-addressed static assets (hash in filename) — safe to cache forever.
        // Cloudflare Workers ASSETS binding serves these; this header is applied by
        // OpenNext before the response leaves the Worker. (Finding 7)
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
