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
      <body>{children}</body>
    </html>
  );
}
