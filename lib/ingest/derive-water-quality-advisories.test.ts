/**
 * Tests for derive-water-quality-advisories.ts — sub-goal 70.
 *
 * Two layers:
 *   1. classifyReading — pure function, no mocking needed.
 *   2. deriveWaterQualityAdvisories — integration, Supabase client mocked.
 *
 * Updated in the source_id refactor (structural dedup):
 *   - existingAdvisories now carries { source_id } instead of { source }
 *   - advisories mock chain: .eq().eq().gt() (source + kind exact match)
 *   - upsert mock replaces insert mock
 *   - Assertions check source='jra_water_quality' + source_id starts 'J23:...'
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';
import { classifyReading, deriveWaterQualityAdvisories } from './derive-water-quality-advisories';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseReading = {
  station_code:              'J23' as string | null,
  station_global_id:         'test-global-id',
  organization:              'JRA' as string | null,
  collected_at:              '2026-05-22T14:00:00Z',
  ecoli_cfu_per_100ml:       null as number | null,
  enterococci_cfu_per_100ml: null as number | null,
};

function reading(overrides: Partial<typeof baseReading> = {}) {
  return { ...baseReading, ...overrides };
}

// ── classifyReading (pure) ────────────────────────────────────────────────────

describe('classifyReading', () => {
  it('returns null when both bacteria fields are null (no measurement)', () => {
    expect(classifyReading(reading(), 'Pony Pasture', false)).toBeNull();
  });

  it('returns null when ecoli is below threshold (safe reading)', () => {
    expect(
      classifyReading(reading({ ecoli_cfu_per_100ml: 80 }), 'Pony Pasture', false),
    ).toBeNull();
  });

  it('returns null when enterococci is below threshold (safe reading)', () => {
    expect(
      classifyReading(reading({ enterococci_cfu_per_100ml: 50 }), 'Pony Pasture', false),
    ).toBeNull();
  });

  it('returns null when both ecoli and enterococci are within range', () => {
    expect(
      classifyReading(
        reading({ ecoli_cfu_per_100ml: 80, enterococci_cfu_per_100ml: 30 }),
        'Pony Pasture',
        false,
      ),
    ).toBeNull();
  });

  it('returns moderate advisory when ecoli exceeds 235 but not 470 (primary station)', () => {
    // 300 > 235 (threshold) but 300 < 470 (2× threshold) → moderate
    const result = classifyReading(
      reading({ ecoli_cfu_per_100ml: 300 }),
      'Pony Pasture',
      false,
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('moderate');
    expect(result!.headline).toBe('Elevated bacteria at Pony Pasture');
    expect(result!.body).toContain('300 CFU/100mL');
    expect(result!.body).toContain('VDH limit 235');
  });

  it('returns high advisory when ecoli exceeds 2× threshold (> 470)', () => {
    const result = classifyReading(
      reading({ ecoli_cfu_per_100ml: 600 }),
      'Pony Pasture',
      false,
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('high');
  });

  it('returns moderate advisory when enterococci exceeds 104', () => {
    const result = classifyReading(
      reading({ enterococci_cfu_per_100ml: 200 }),
      'Rope Swing at Tredegar',
      false,
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('moderate');
    expect(result!.body).toContain('200 CFU/100mL');
    expect(result!.body).toContain('VDH limit 104');
  });

  it('returns high advisory when enterococci exceeds 2× threshold (> 208)', () => {
    const result = classifyReading(
      reading({ enterococci_cfu_per_100ml: 250 }),
      'Rope Swing at Tredegar',
      false,
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('high');
  });

  it('returns low advisory for upstream watch station regardless of value', () => {
    const result = classifyReading(
      reading({ ecoli_cfu_per_100ml: 999 }), // would be 'high' if primary
      'Huguenot Flatwater',
      true /* isUpstreamWatch */,
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('low');
    expect(result!.headline).toBe('Upstream watch — Huguenot Flatwater');
    expect(result!.body).toContain('upstream station');
    expect(result!.body).toContain('12–24 hours');
  });

  it('upstream watch also returns null when both values are null', () => {
    expect(classifyReading(reading(), 'Huguenot Flatwater', true)).toBeNull();
  });

  it('upstream watch returns null when values are within range', () => {
    expect(
      classifyReading(reading({ ecoli_cfu_per_100ml: 100 }), 'Huguenot Flatwater', true),
    ).toBeNull();
  });

  it('uses explicit null guard — ecoli=null does not trigger advisory even if entero=0', () => {
    // Both null explicitly — null > 235 must NOT evaluate to true
    const result = classifyReading(
      reading({ ecoli_cfu_per_100ml: null, enterococci_cfu_per_100ml: 0 }),
      'Station',
      false,
    );
    expect(result).toBeNull(); // entero=0 is below threshold; ecoli null = not measured
  });
});

// ── deriveWaterQualityAdvisories (integration, Supabase mocked) ───────────────

/**
 * Build a minimal Supabase mock that handles the four query chains used by
 * deriveWaterQualityAdvisories:
 *   1. water_quality_readings → latest readings
 *   2. locations              → id/slug pairs
 *   3. advisories (select)    → existing source_ids (.eq.eq.gt chain)
 *   4. advisories (upsert)    → write result
 */
function makeMockClient({
  readings                = [] as object[],
  locations               = [{ id: 'loc-pony', slug: 'pony-pasture' }],
  existingAdvisories      = [] as { source_id: string | null }[],
  readingsError           = null as { message: string } | null,
  upsertError             = null as { message: string } | null,
} = {}) {
  const upsertMock = vi.fn().mockResolvedValue({ error: upsertError });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'water_quality_readings') {
      const limitMock  = vi.fn().mockResolvedValue({ data: readings, error: readingsError });
      const orderMock  = vi.fn().mockReturnValue({ limit: limitMock });
      const gteMock    = vi.fn().mockReturnValue({ order: orderMock });
      const inMock     = vi.fn().mockReturnValue({ gte: gteMock });
      const selectMock = vi.fn().mockReturnValue({ in: inMock });
      return { select: selectMock };
    }

    if (table === 'locations') {
      const inMock     = vi.fn().mockResolvedValue({ data: locations, error: null });
      const selectMock = vi.fn().mockReturnValue({ in: inMock });
      return { select: selectMock };
    }

    if (table === 'advisories') {
      // Chain: .select('source_id').eq('kind','water_quality').eq('source', SOURCE_SYSTEM).gt(...)
      const gtMock    = vi.fn().mockResolvedValue({ data: existingAdvisories, error: null });
      const eq2Mock   = vi.fn().mockReturnValue({ gt: gtMock });
      const eq1Mock   = vi.fn().mockReturnValue({ eq: eq2Mock });
      const selectMock = vi.fn().mockReturnValue({ eq: eq1Mock });
      return { select: selectMock, upsert: upsertMock };
    }

    return {};
  });

  return { from: fromMock, _upsertMock: upsertMock };
}

describe('deriveWaterQualityAdvisories', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns ok:true with 0 rowsWritten when no recent readings exist', async () => {
    const mockClient = makeMockClient({ readings: [] });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await deriveWaterQualityAdvisories();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
    expect(mockClient._upsertMock).not.toHaveBeenCalled();
  });

  it('returns ok:false when reading query errors', async () => {
    const mockClient = makeMockClient({
      readingsError: { message: 'connection refused' },
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await deriveWaterQualityAdvisories();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('connection refused');
  });

  it('upserts one advisory when a primary station reading exceeds threshold', async () => {
    // 300 > 235 but 300 < 470 → moderate
    const mockClient = makeMockClient({
      readings: [{
        station_code:              'J23',
        station_global_id:         'gid-1',
        organization:              'JRA',
        collected_at:              '2026-05-22T14:00:00Z',
        ecoli_cfu_per_100ml:       300,
        enterococci_cfu_per_100ml: null,
      }],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await deriveWaterQualityAdvisories();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(1);
    expect(mockClient._upsertMock).toHaveBeenCalledOnce();

    const upsertedRow = mockClient._upsertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(upsertedRow.kind).toBe('water_quality');
    expect(upsertedRow.severity).toBe('moderate');
    // source is now the canonical system name, source_id carries the natural key
    expect(upsertedRow.source).toBe('jra_water_quality');
    expect(upsertedRow.source_id).toMatch(/^J23:/);
    expect((upsertedRow.location_ids as string[]).length).toBeGreaterThan(0);
  });

  it('skips upsert when source_id already exists (idempotent on re-run)', async () => {
    const sourceId = 'J23:2026-05-22';
    const mockClient = makeMockClient({
      readings: [{
        station_code:              'J23',
        station_global_id:         'gid-1',
        organization:              'JRA',
        collected_at:              '2026-05-22T14:00:00Z',
        ecoli_cfu_per_100ml:       500,
        enterococci_cfu_per_100ml: null,
      }],
      existingAdvisories: [{ source_id: sourceId }],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await deriveWaterQualityAdvisories();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
    expect(mockClient._upsertMock).not.toHaveBeenCalled();
  });

  it('writes no advisory when reading is within safe range', async () => {
    const mockClient = makeMockClient({
      readings: [{
        station_code:              'J23',
        station_global_id:         'gid-2',
        organization:              'JRA',
        collected_at:              '2026-05-22T14:00:00Z',
        ecoli_cfu_per_100ml:       80,
        enterococci_cfu_per_100ml: null,
      }],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await deriveWaterQualityAdvisories();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
  });

  it('writes no advisory when both bacteria fields are null (off-season)', async () => {
    const mockClient = makeMockClient({
      readings: [{
        station_code:              'J23',
        station_global_id:         'gid-3',
        organization:              'JRA',
        collected_at:              '2026-05-22T14:00:00Z',
        ecoli_cfu_per_100ml:       null,
        enterococci_cfu_per_100ml: null,
      }],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    const result = await deriveWaterQualityAdvisories();

    expect(result.ok).toBe(true);
    expect(result.rowsWritten).toBe(0);
  });

  it('sets severity=high when ecoli exceeds 2× threshold', async () => {
    const mockClient = makeMockClient({
      readings: [{
        station_code:              'J23',
        station_global_id:         'gid-4',
        organization:              'JRA',
        collected_at:              '2026-05-22T14:00:00Z',
        ecoli_cfu_per_100ml:       600,
        enterococci_cfu_per_100ml: null,
      }],
    });
    vi.mocked(createServerClient).mockResolvedValue(mockClient as never);

    await deriveWaterQualityAdvisories();

    const upsertedRow = mockClient._upsertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(upsertedRow.severity).toBe('high');
  });
});

// ── Confirm bacterialStatus('unknown') for null (sub-goal 70 success criterion) ─

import { bacterialStatus } from '@/lib/safety/rules';

describe('bacterialStatus', () => {
  it('returns unknown when latestCfu is null', () => {
    expect(bacterialStatus(null)).toBe('unknown');
  });

  it('returns safe for a value well below the threshold', () => {
    expect(bacterialStatus(80)).toBe('safe');
  });

  it('returns caution at the VDH single-sample max (235)', () => {
    expect(bacterialStatus(235)).toBe('caution');
  });

  it('returns danger at or above ecoli_unsafe_cfu_per_100ml (1000)', () => {
    expect(bacterialStatus(1000)).toBe('danger');
  });
});
