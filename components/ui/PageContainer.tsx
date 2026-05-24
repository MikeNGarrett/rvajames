/**
 * PageContainer — responsive page-width constraint.
 *
 * Mobile-first max-width scale per docs/responsive-guidelines.md:
 *   < 640px  (mobile)  → max-w-lg   (~512px)  — original mobile-first width
 *   640–767px (sm)     → max-w-xl   (~576px)
 *   768–1023px (md)    → max-w-3xl  (~768px)
 *   1024–1279px (lg)   → max-w-4xl  (~896px)
 *   ≥ 1280px (xl)      → max-w-5xl  (~1024px)
 *
 * All routes that want the standard dashboard width should wrap their content
 * in this component rather than repeating the class string. Sub-goals 49–52
 * apply this to every top-level route.
 *
 * Note: `py-5` and other page-specific spacing is NOT included here — callers
 * set their own vertical rhythm. Only the horizontal max-width + centering is
 * centralised.
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'max-w-lg sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl',
        'mx-auto px-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
