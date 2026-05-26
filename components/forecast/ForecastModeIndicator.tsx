/**
 * Inline forecast confidence tag + tooltip for panel headers.
 *
 * Renders nothing for observed mode. For forecast mode, shows a colour-coded
 * confidence tag ("Forecast confidence: high/medium/low") with an ⓘ info
 * button that expands an inline explanation via <details>/<summary>.
 *
 * Uses <details>/<summary> so keyboard users can toggle with Enter/Space and
 * dismiss with Esc, and screen readers announce the disclosed content inline
 * without requiring JS.
 */

interface Props {
  mode: 'observed' | 'forecast';
  forecastConfidence: 'high' | 'medium' | 'low' | null;
}

const TAG_STYLES: Record<'high' | 'medium' | 'low', string> = {
  high:   'bg-rva-blue/10 text-rva-navy',
  medium: 'bg-status-caution-subtle text-status-caution-fg',
  low:    'bg-surface text-text-secondary border border-border',
};

export function ForecastModeIndicator({ mode, forecastConfidence }: Props) {
  if (mode !== 'forecast' || !forecastConfidence) return null;

  return (
    <details className="mt-1.5">
      <summary className="inline-flex items-center gap-2 min-h-[2.75rem] list-none cursor-pointer select-none rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rva-blue">
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TAG_STYLES[forecastConfidence]}`}>
          Forecast confidence: {forecastConfidence}
        </span>
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-text-muted/50 text-[0.625rem] font-bold text-text-muted flex-shrink-0"
          aria-hidden="true"
        >
          i
        </span>
      </summary>
      <p className="mt-2 text-xs text-text-secondary leading-relaxed max-w-prose">
        Based on NOAA AHPS river forecast and NWS weather forecast. Accuracy
        decreases the further out.
      </p>
    </details>
  );
}
