/**
 * Tests for the SEC-3 cost-ceiling env getter. In vitest there is no
 * Cloudflare context, so lib/env.ts falls back to process.env.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { getAiDailyCostCeilingUsd } from './env';

const KEY = 'AI_DAILY_COST_CEILING_USD';

afterEach(() => {
  delete process.env[KEY];
});

describe('getAiDailyCostCeilingUsd', () => {
  it('defaults to $5 when unset', async () => {
    delete process.env[KEY];
    expect(await getAiDailyCostCeilingUsd()).toBe(5);
  });

  it('reads the configured value', async () => {
    process.env[KEY] = '2.5';
    expect(await getAiDailyCostCeilingUsd()).toBe(2.5);
  });

  it('falls back to $5 on unparsable or non-positive values', async () => {
    process.env[KEY] = 'not-a-number';
    expect(await getAiDailyCostCeilingUsd()).toBe(5);
    process.env[KEY] = '0';
    expect(await getAiDailyCostCeilingUsd()).toBe(5);
    process.env[KEY] = '-1';
    expect(await getAiDailyCostCeilingUsd()).toBe(5);
  });
});
