import Link from 'next/link';
import type { AgeBucket } from '@/lib/url-state';

interface Props {
  ageBucket?: AgeBucket;
}

export function DisclaimerFooter({ ageBucket }: Props = {}) {
  const showKidsMicrocopy = ageBucket !== 'none';

  return (
    <footer className="mt-8 border-t border-border pt-6 pb-8 px-4 text-sm text-text-muted max-w-prose">
      <p className="mb-2">
        <strong className="text-text-secondary">RVA James</strong> is an independent informational tool.
        River conditions change rapidly — always use your own judgment.
        In an emergency, call 911 or check{' '}
        <a
          href="https://www.weather.gov/akq/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          NWS Wakefield
        </a>{' '}
        for official flood warnings.
      </p>
      <p className="mb-2">
        Recommendations are AI-generated from sensor data and do not constitute professional safety advice.
        {showKidsMicrocopy && (
          <> See our{' '}
            <Link href="/safety" className="underline">
              safety resources
            </Link>{' '}
            for AAP, NPS, and USCG guidance on children near water.
          </>
        )}
        {!showKidsMicrocopy && (
          <> See our{' '}
            <Link href="/safety" className="underline">
              safety resources
            </Link>{' '}
            for NPS and USCG guidelines.
          </>
        )}
      </p>
      <p className="mt-3 text-xs text-text-muted">
        Water quality data from{' '}
        <a
          href="https://thejamesriver.org/james-river-watch/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          James River Watch
        </a>
        , a program of the James River Association with data collected by volunteers from the
        James River Association, Rivanna Conservation Alliance, Rockbridge Area Conservation,
        Allegheny-Blue Ridge Alliance, Peninsula Master Naturalists, American Water,
        Virginia State University, and USGS.
      </p>
      <p className="text-xs mt-2 text-text-muted">
        Not affiliated with the City of Richmond or James River Association.
      </p>
    </footer>
  );
}
