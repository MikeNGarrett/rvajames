import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Binds Cloudflare platform APIs during `next dev` so getCloudflareContext() works.
if (process.env.NODE_ENV !== 'production') {
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
