import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brand Tokens — RVA James',
  description: 'Richmond city brand color tokens and typography for the RVA James dashboard.',
};

// ─── WCAG 2.1 contrast ratio helpers ────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

type AaLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

function aaLevel(ratio: number): AaLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

function badgeColor(level: AaLevel): string {
  if (level === 'AAA' || level === 'AA') return '#1a5c28';
  if (level === 'AA Large') return '#5a4000';
  return '#aa242a';
}

// ─── Color definitions ───────────────────────────────────────────────────────

type Swatch = { name: string; token: string; hex: string; fg: string; pantone?: string };

const PRIMARY: Swatch[] = [
  { name: 'CoR Blue',    token: 'rva-blue',       hex: '#264677', fg: '#ffffff', pantone: '7687 C' },
  { name: 'CoR Red',     token: 'rva-red',        hex: '#aa242a', fg: '#ffffff', pantone: '7621 C' },
  { name: 'Light Blue',  token: 'rva-light-blue', hex: '#7fb1e5', fg: '#1a1f2e', pantone: '284 C'  },
  { name: 'Navy Blue',   token: 'rva-navy',       hex: '#1e385f', fg: '#ffffff', pantone: '534 C'  },
];

const ACCENT: Swatch[] = [
  { name: 'Capitol Gold',     token: 'rva-gold',   hex: '#ffe86b', fg: '#1a1f2e', pantone: '2003 C' },
  { name: 'Southside Sunset', token: 'rva-sunset', hex: '#e0a2d4', fg: '#1a1f2e', pantone: '2064 C' },
  { name: 'Libby Sunrise',    token: 'rva-coral',  hex: '#ff8666', fg: '#1a1f2e', pantone: '1635 C' },
  { name: 'Walker Green',     token: 'rva-green',  hex: '#a8dd83', fg: '#1a1f2e', pantone: '359 C'  },
];

type StatusSwatch = { label: string; name: string; bg: string; fg: string; token: string };

const SEMANTIC: StatusSwatch[] = [
  { label: 'Safe',           name: 'Walker Green',  bg: '#a8dd83', fg: '#1a5c28', token: 'status-safe'    },
  { label: 'Caution',        name: 'Capitol Gold',  bg: '#ffe86b', fg: '#5a4000', token: 'status-caution' },
  { label: 'Danger',         name: 'CoR Red',       bg: '#aa242a', fg: '#ffffff', token: 'status-danger'  },
  { label: 'Flood Advisory', name: 'CoR Blue',      bg: '#264677', fg: '#ffffff', token: 'status-flood'   },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ContrastBadge({ ratio, level }: { ratio: number; level: AaLevel }) {
  const color = badgeColor(level);
  return (
    <span style={{ color, fontWeight: 600, fontSize: '0.75rem' }}>
      {level} {ratio.toFixed(1)}:1
    </span>
  );
}

function ColorSwatch({ swatch }: { swatch: Swatch }) {
  const ratio = contrastRatio(swatch.fg, swatch.hex);
  const level = aaLevel(ratio);
  return (
    <div style={{ borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #dde3ec' }}>
      <div
        style={{
          background: swatch.hex,
          height: '5rem',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0.5rem',
        }}
      >
        <span style={{ color: swatch.fg, fontWeight: 700, fontSize: '0.875rem' }}>
          Sample text
        </span>
      </div>
      <div style={{ padding: '0.75rem', background: '#fff' }}>
        <p style={{ fontWeight: 700, margin: 0, fontSize: '0.875rem' }}>{swatch.name}</p>
        <p style={{ margin: '0.1rem 0', fontFamily: 'monospace', fontSize: '0.8rem', color: '#4a5568' }}>
          {swatch.hex.toUpperCase()}
        </p>
        {swatch.pantone && (
          <p style={{ margin: '0.1rem 0', fontSize: '0.75rem', color: '#718096' }}>
            Pantone {swatch.pantone}
          </p>
        )}
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
          <ContrastBadge ratio={ratio} level={level} />
        </p>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#718096' }}>
          on {swatch.fg.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

function StatusTile({ s }: { s: StatusSwatch }) {
  const ratio = contrastRatio(s.fg, s.bg);
  const level = aaLevel(ratio);
  return (
    <div
      style={{
        background: s.bg,
        color: s.fg,
        borderRadius: '0.5rem',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <p style={{ fontWeight: 700, margin: 0 }}>{s.label}</p>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
          {s.name} · {s.token}
        </p>
      </div>
      <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>
        {level} {ratio.toFixed(1)}:1
      </span>
    </div>
  );
}

// ─── Contrast verification summary ──────────────────────────────────────────

function verifyAllPairs(): { label: string; fg: string; bg: string; ratio: number; level: AaLevel; pass: boolean }[] {
  const pairs = [
    ...PRIMARY.map(s => ({ label: `${s.name} · fg on swatch`, fg: s.fg, bg: s.hex })),
    ...ACCENT.map(s => ({ label: `${s.name} · fg on swatch`, fg: s.fg, bg: s.hex })),
    ...SEMANTIC.map(s => ({ label: `${s.label} · ${s.token}`, fg: s.fg, bg: s.bg })),
  ];
  return pairs.map(p => {
    const ratio = contrastRatio(p.fg, p.bg);
    const level = aaLevel(ratio);
    return { ...p, ratio, level, pass: ratio >= 4.5 };
  });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BrandPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const verifications = verifyAllPairs();
  const allPass = verifications.every(v => v.pass);

  return (
    <main
      style={{
        maxWidth: '64rem',
        margin: '0 auto',
        padding: '1.5rem 1rem',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <header style={{ marginBottom: '2rem' }}>
        <p style={{ color: '#718096', margin: '0 0 0.25rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          RVA James
        </p>
        <h1 style={{ margin: 0, fontSize: 'var(--text-3xl)', fontWeight: 800, color: '#264677' }}>
          Brand Tokens
        </h1>
        <p style={{ marginTop: '0.5rem', color: '#4a5568' }}>
          Richmond City official colors + dashboard semantic palette. All pairs verified against WCAG 2.1 AA (≥ 4.5:1).
        </p>
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            background: allPass ? '#eaf5e2' : '#fce8e9',
            borderRadius: '0.375rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: allPass ? '#1a5c28' : '#aa242a',
          }}
        >
          {allPass ? '✓ All contrast pairs pass AA' : '✗ Some pairs fail AA — see table below'}
        </div>
      </header>

      {/* Primary Palette */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '1rem', color: '#1a1f2e' }}>
          Primary Palette
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
          }}
        >
          {PRIMARY.map(s => <ColorSwatch key={s.token} swatch={s} />)}
        </div>
      </section>

      {/* Accent Palette */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '1rem', color: '#1a1f2e' }}>
          Accent Palette
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
          }}
        >
          {ACCENT.map(s => <ColorSwatch key={s.token} swatch={s} />)}
        </div>
      </section>

      {/* Semantic Status Colors */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '0.5rem', color: '#1a1f2e' }}>
          Semantic Status Colors
        </h2>
        <p style={{ color: '#4a5568', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Used for river condition tiles and advisory banners.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {SEMANTIC.map(s => <StatusTile key={s.token} s={s} />)}
        </div>
      </section>

      {/* Typography */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '1rem', color: '#1a1f2e' }}>
          Typography — Nunito Sans
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(
            [
              { label: 'text-4xl / 800', size: '2.25rem', weight: 800, lh: '2.5rem' },
              { label: 'text-3xl / 700', size: '1.875rem', weight: 700, lh: '2.25rem' },
              { label: 'text-2xl / 600', size: '1.5rem', weight: 600, lh: '2rem' },
              { label: 'text-xl / 600', size: '1.25rem', weight: 600, lh: '1.75rem' },
              { label: 'text-lg / 500', size: '1.125rem', weight: 500, lh: '1.75rem' },
              { label: 'text-base / 400', size: '1rem', weight: 400, lh: '1.5rem' },
              { label: 'text-sm / 400', size: '0.875rem', weight: 400, lh: '1.25rem' },
            ] as const
          ).map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: t.lh, color: '#1a1f2e', flexShrink: 0 }}>
                James River
              </span>
              <span style={{ fontSize: '0.75rem', color: '#718096', fontFamily: 'monospace' }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Touch Target Demo */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '0.5rem', color: '#1a1f2e' }}>
          Touch Targets
        </h2>
        <p style={{ color: '#4a5568', marginBottom: '1rem', fontSize: '0.875rem' }}>
          All interactive elements enforce a 44 × 44 px minimum hit area (WCAG 2.5.5 AAA / Apple HIG).
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            style={{
              minHeight: '2.75rem',
              minWidth: '2.75rem',
              padding: '0 1.25rem',
              background: '#264677',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.9375rem',
            }}
          >
            Primary action
          </button>
          <button
            style={{
              minHeight: '2.75rem',
              minWidth: '2.75rem',
              padding: '0 1.25rem',
              background: '#aa242a',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.9375rem',
            }}
          >
            Danger action
          </button>
        </div>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#718096' }}>
          Rendered at 375 px viewport width before any breakpoint override.
        </p>
      </section>

      {/* Contrast verification table */}
      <section>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '1rem', color: '#1a1f2e' }}>
          Contrast Verification (WCAG 2.1 AA)
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #dde3ec' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#4a5568' }}>Pair</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#4a5568' }}>Ratio</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#4a5568' }}>Level</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#4a5568' }}>Pass AA?</th>
              </tr>
            </thead>
            <tbody>
              {verifications.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #dde3ec', background: v.pass ? undefined : '#fce8e9' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{v.label}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    {v.ratio.toFixed(2)}:1
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: badgeColor(v.level) }}>
                    {v.level}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: v.pass ? '#1a5c28' : '#aa242a' }}>
                    {v.pass ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
