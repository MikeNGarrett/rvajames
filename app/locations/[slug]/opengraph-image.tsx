import { ImageResponse } from 'next/og';

export const alt = 'RVA James — James River conditions';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ slug: string }>;
}

const SLUG_NAMES: Record<string, string> = {
  'belle-isle': 'Belle Isle',
  'pony-pasture': 'Pony Pasture Rapids',
  'texas-beach': 'Texas Beach',
  'browns-island': 'Browns Island',
  'mayo-island': 'Mayo Island',
  'shiplock-trail': 'Shiplock Trail',
  'north-bank-trail': 'North Bank Trail',
  'buttermilk-trail': 'Buttermilk Trail',
  'pump-house': 'Pump House',
};

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const name = SLUG_NAMES[slug] ?? slug;

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
          RVA James · James River
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#a8dd83',
            fontWeight: 600,
          }}
        >
          Current conditions for Richmond families
        </div>
      </div>
    ),
    { ...size },
  );
}
