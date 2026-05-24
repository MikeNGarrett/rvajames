import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * App favicon — "RJ" monogram on Richmond Blue (#264677).
 * Next.js App Router serves this at /icon.png and adds <link rel="icon"> to <head>.
 * A favicon.ico binary is also present for legacy browser requests.
 * (Finding 9)
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#264677',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        RJ
      </div>
    ),
    { ...size },
  );
}
