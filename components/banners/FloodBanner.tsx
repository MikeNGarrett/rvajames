export function FloodBanner() {
  return (
    <div
      className="sticky top-0 z-40 bg-status-flood text-status-flood-fg text-sm font-semibold text-center py-3 px-4"
      role="alert"
    >
      <span className="inline-block max-w-prose">
        Active Flood Advisory — Stay away from the riverbank. Check{' '}
        <a
          href="https://www.weather.gov/akq/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          NWS Wakefield
        </a>{' '}
        for current conditions.
      </span>
    </div>
  );
}
