import type { MetadataRoute } from 'next';
import { getAllLocationSlugs } from '@/lib/queries/location';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllLocationSlugs();
  const base = 'https://rva-james.workers.dev';

  const locationUrls: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${base}/locations/${slug}`,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [
    { url: base, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${base}/safety`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/status`, changeFrequency: 'hourly', priority: 0.3 },
    ...locationUrls,
  ];
}
