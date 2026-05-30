import type { Metadata } from 'next';
import Link from 'next/link';
import { DisclaimerFooter } from '@/components/legal/DisclaimerFooter';
import { PageContainer } from '@/components/ui/PageContainer';

export const metadata: Metadata = {
  title: 'Safety Resources — RVA James',
  description: 'Official safety guidance from AAP, NPS, and USCG for James River family outings.',
};

export default function SafetyPage() {
  return (
    <main>
    <PageContainer className="py-5">
      <Link href="/" className="inline-flex items-center text-sm text-rva-blue mb-4 touch-target">
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-extrabold text-text mb-2">Safety resources</h1>
      <p className="text-text-secondary text-sm mb-6 max-w-prose">
        RVA James uses these official sources to ground its recommendations. Always defer to your
        own judgment and these authorities over any AI-generated guidance.
      </p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">Water & swimming safety</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none p-0 m-0">
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">
              American Academy of Pediatrics (AAP)
            </p>
            <p className="text-sm text-text-secondary mb-2">
              Drowning prevention guidelines, minimum swimming age recommendations, and life jacket
              requirements by age. The basis for our swim threshold rules.
            </p>
            <a
              href="https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Water-Safety-And-Young-Children.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              AAP water safety guidelines →
            </a>
          </li>
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">
              U.S. Coast Guard (USCG)
            </p>
            <p className="text-sm text-text-secondary mb-2">
              Life jacket requirements, paddlesport regulations, and boating safety. All children
              under 13 are required to wear a USCG-approved PFD on or near the water.
            </p>
            <a
              href="https://www.uscgboating.org/safety/life_jacket_wear.php"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              USCG life jacket guide →
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">River conditions</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none p-0 m-0">
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">USGS Gage 02037500 — James River at Richmond</p>
            <p className="text-sm text-text-secondary mb-2">
              Real-time gage height and discharge for the James River at Richmond. Updated every 15
              minutes. This is the primary data source for our river level readings.
            </p>
            <a
              href="https://waterdata.usgs.gov/monitoring-location/02037500/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              USGS stream gage →
            </a>
          </li>
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">
              NWS Wakefield — Flood forecasts
            </p>
            <p className="text-sm text-text-secondary mb-2">
              Official flood watches, warnings, and advisories for the Richmond area. Call 911 or
              check here in any emergency.
            </p>
            <a
              href="https://www.weather.gov/akq/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              NWS Wakefield →
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">Water quality</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none p-0 m-0">
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">James River Association — James River Watch</p>
            <p className="text-sm text-text-secondary mb-2">
              E. coli monitoring and swim safety advisories. We use the Virginia DEQ standard of
              235 CFU/100 mL as our swim-safe threshold.
            </p>
            <a
              href="https://www.thejamesriver.org/james-river-watch/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              JRA James River Watch →
            </a>
          </li>
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">Richmond DPU — CSO Advisories</p>
            <p className="text-sm text-text-secondary mb-2">
              Combined sewer overflow notifications. After heavy rain, sewer overflows increase
              bacterial levels. We recommend no swimming for 48 hours after any active CSO advisory.
            </p>
            <a
              href="https://www.rva.gov/public-utilities/combined-sewer-overflow-advisory"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              RVA DPU CSO page →
            </a>
          </li>
        </ul>
      </section>

      <section id="cso" className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">Combined Sewer Overflows in Richmond</h2>
        <div className="rounded-xl border border-border bg-surface-raised p-4 max-w-prose space-y-4 text-sm text-text-secondary leading-relaxed">
          <p>
            Richmond&rsquo;s combined sewer system carries both sewage and stormwater in the same
            underground pipes. On most days, everything flows to the treatment plant as intended.
            After heavy rain, however, the volume can overwhelm the plant&rsquo;s capacity — and
            the overflow valves open, releasing a mix of untreated sewage and stormwater directly
            into the James River to prevent backups into streets and basements. This is a combined
            sewer overflow, or CSO.
          </p>
          <p>
            The combined system covers much of downtown Richmond, running along the same stretch of
            the James where most of the popular river access points are — Brown&rsquo;s Island,
            Belle Isle, the Manchester Climbing Wall, and others. After significant rain (typically
            anything over half an inch in a few hours), overflows at multiple outfalls are common.
            The monitoring data on this site comes from Richmond DPU&rsquo;s{' '}
            <a
              href="https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rva-blue underline"
            >
              EmNet real-time monitoring system
            </a>
            , which tracks each outfall&rsquo;s active discharge status.
          </p>
          <p>
            Bacterial levels in the James — particularly E.&nbsp;coli and enterococcus — spike
            after a CSO event and take time to return to safe levels. Richmond DPU and the James
            River Association both recommend avoiding water contact for at least 48 hours after a
            known overflow. That&rsquo;s why this site shows an advisory window extending 48 hours
            from the most recent observed discharge, even if the overflow has already stopped. When
            a site is still actively discharging, the window keeps extending so it always reflects
            the full expected recovery time.
          </p>
          <div className="pt-2 space-y-1.5 border-t border-border">
            <p className="font-medium text-text text-xs uppercase tracking-wide">Sources</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.rva.gov/public-utilities/combined-sewer-overflow-advisory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rva-blue underline"
                >
                  Richmond DPU — Combined Sewer Overflow Advisories
                </a>
              </li>
              <li>
                <a
                  href="https://apps.emnet.net/richmond-pub-map-app/?city=47&config=5c0cacee-7e95-4eea-922d-c736c83eb4b9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rva-blue underline"
                >
                  EmNet — Richmond CSO real-time monitoring map
                </a>
              </li>
              <li>
                <a
                  href="https://www.cdc.gov/healthywater/swimming/swimmers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rva-blue underline"
                >
                  CDC — Healthy Swimming for recreational water users
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">Trail safety</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none p-0 m-0">
          <li className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="font-semibold text-text mb-1">NPS — Trail difficulty standards</p>
            <p className="text-sm text-text-secondary mb-2">
              National Park Service trail difficulty rating norms used to calibrate our hiking
              recommendations by age.
            </p>
            <a
              href="https://www.nps.gov/subjects/outdoorrecreation/hiking.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rva-blue underline"
            >
              NPS hiking safety →
            </a>
          </li>
        </ul>
      </section>

      <DisclaimerFooter />
    </PageContainer>
    </main>
  );
}
