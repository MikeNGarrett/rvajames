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
