/**
 * Root OpenGraph image — Finding 20.
 *
 * Next.js App Router convention: this file auto-wires og:image and
 * twitter:image in <head>. runtime='edge' required for Cloudflare Workers.
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'RVA James — James River Family Dashboard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#264677',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: '#7fb1e5',
            marginBottom: 16,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Richmond, Virginia
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.0,
            marginBottom: 20,
          }}
        >
          RVA James
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#a8dd83',
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          James River conditions for families
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#7fb1e5',
          }}
        >
          River levels · Water quality · Activity recommendations
        </div>
      </div>
    ),
    { ...size },
  );
}
