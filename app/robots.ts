import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    // Canonical site URL — must match app/sitemap.ts `base` and
    // app/layout.tsx `metadataBase` so search engines see consistent
    // canonical links across all metadata surfaces.
    sitemap: 'https://rvajames.org/sitemap.xml',
  };
}
