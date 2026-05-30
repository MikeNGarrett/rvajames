/**
 * Spinner — small inline loading indicator (sub-goal 64).
 *
 * 16×16 SVG by default. Uses Tailwind's `animate-spin` which respects
 * prefers-reduced-motion via `motion-reduce:animate-none` (we add that
 * modifier here, not at the call site, so every Spinner is reduced-motion
 * safe by default).
 *
 * Color: inherits `currentColor` from the parent, so callers can switch
 * tone by wrapping in a colored container (e.g. text-rva-blue for the
 * metro panel; text-text-muted for less-prominent surfaces).
 *
 * A11y: role="status" + aria-label so screen readers announce a loading
 * state. Pass a more specific label when context matters
 * (e.g. label="Loading recommendations") so AT users hear what's loading,
 * not just "loading".
 */
interface Props {
  /** Pixel size of the spinner. Default 16. */
  size?: number;
  /** aria-label override. Default "Loading". */
  label?: string;
  /** Extra classes (positioning, color hooks). */
  className?: string;
}

export function Spinner({ size = 16, label = 'Loading', className }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={['inline-flex shrink-0 items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin motion-reduce:animate-none"
        aria-hidden
      >
        {/* Faint full circle as the track */}
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.25"
        />
        {/* Arc segment that rotates */}
        <path
          d="M21 12 a 9 9 0 0 0 -9 -9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
