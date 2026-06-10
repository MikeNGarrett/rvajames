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

  // Workaround for Next.js issue #89844 — dev-overlay code leaking into
  // production client bundles. Even after 15.5.19's partial fix to
  // app-globals.js, multiple other client entry points
  // (app-index.js, app-next-turbopack.js, client/index.js) still
  // `require('../next-devtools/...')` inside `if (NODE_ENV !== 'production')`
  // guards that webpack does NOT tree-shake. Result before this workaround:
  // a ~217 KB shared chunk on every page, 100% unused at runtime.
  //
  // Alias the dev-overlay entry points to `false` (webpack 5 idiom for
  // "resolve to empty module") in production builds. The `if` blocks
  // that would call these requires never execute in prod, so swapping
  // them for empty modules is safe.
  //
  // Revisit when Next.js ships a complete fix (#89844 is still open).
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'next/dist/next-devtools/userspace/app/app-dev-overlay-setup': false,
        'next/dist/next-devtools/userspace/app/client-entry':          false,
        'next/dist/next-devtools/userspace/pages/pages-dev-overlay-setup': false,
        'next/dist/next-devtools/userspace/app/errors/stitched-error': false,
        'next/dist/compiled/next-devtools':                            false,
      };
    }
    return config;
  },

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
