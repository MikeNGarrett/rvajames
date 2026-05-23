export function StaleState({ source, ageMinutes }: { source: string; ageMinutes: number }) {
  return (
    <div className="rounded-xl bg-status-caution-subtle border border-status-caution p-4 text-sm text-status-caution-fg">
      <strong>{source}</strong> data hasn&apos;t updated in {ageMinutes} minutes. Conditions shown
      may not reflect current state — check{' '}
      <a
        href="https://waterdata.usgs.gov/monitoring-location/02037500/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        USGS directly
      </a>{' '}
      for the latest gage reading.
    </div>
  );
}
