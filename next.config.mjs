import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Binds Cloudflare platform APIs during `next dev` so getCloudflareContext() works.
if (process.env.NODE_ENV !== 'production') {
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @cloudflare/puppeteer is a Cloudflare Workers-only package. Marking it as
  // a server external prevents Next.js from bundling it during `next build`
  // (which runs in Node.js and can't execute the Workers-specific module).
  // The actual Workers build (`pnpm build:cf`) uses esbuild, which handles
  // this correctly without the external hint.
  serverExternalPackages: ['@cloudflare/puppeteer'],

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
