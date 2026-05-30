/**
 * SkeletonShimmer — wraps a skeleton silhouette with a subtle left-to-right
 * gradient sweep (sub-goal 64).
 *
 * Layout: the wrapper is `position: relative` + `overflow: hidden`. The
 * shimmer overlay is `position: absolute` covering the full bounds, with a
 * translucent diagonal gradient that translates from -100% to +100% over 2s.
 * The skeleton itself stays in place underneath; only the overlay animates.
 *
 * Pure CSS animation defined in app/globals.css (@keyframes shimmer).
 * `motion-reduce:animate-none` honours user accessibility preferences.
 *
 * Why this exists (vs. just animate-pulse on each placeholder bar): the
 * shimmer reads as "fresh content is on the way" rather than "this is
 * paused and idle." The plan calls this out as a distinct loading
 * affordance from the existing animate-pulse skeleton style — both can
 * stack (pulse on the placeholder bars; shimmer over the whole panel).
 */
interface Props {
  children: React.ReactNode;
  /** Extra classes for the wrapper (e.g. layout-specific positioning). */
  className?: string;
}

export function SkeletonShimmer({ children, className }: Props) {
  return (
    <div
      className={['relative overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {/*
       * Overlay: aria-hidden because it's pure decoration.
       * The shimmer keyframes (defined in globals.css) translate this
       * element from -100% (offscreen left) to +100% (offscreen right).
       * The linear gradient inside it is what the user perceives as the
       * "sweep" — semi-transparent white peaks at 50% and fades to fully
       * transparent at the ends.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-[shimmer_2s_infinite_linear] motion-reduce:animate-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)',
        }}
      />
    </div>
  );
}
