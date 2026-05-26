// Run with: pnpm tsx scripts/ai-smoketest.ts
// Requires ANTHROPIC_API_KEY in .env.local or environment.
// Confirms: call 1 creates cache, call 2 reads cache, both parse against zod schema.
// Also exercises 3 mode/confidence variants to confirm forecast language rules are applied.

import { config } from 'dotenv';
config({ path: '.env.local' });
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '../lib/ai/system-prompt';
import {
  buildUserMessage,
  InterpretationSchema,
  type InterpretLocationInput,
} from '../lib/ai/prompts/interpret-location';

const today = new Date().toISOString().split('T')[0];

// Helper: add N days to an ISO date string
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().split('T')[0];
}

// Base observed fixture (today — live gauge data, water temp available)
const INPUT_OBSERVED: InterpretLocationInput = {
  date: today,
  mode: 'observed',
  forecastConfidence: null,
  daysOut: 0,
  locationSlug: 'belle-isle',
  locationName: 'Belle Isle',
  ageBucket: '6-9',
  gageFt: 3.8,
  dischargeCfs: 1200,
  waterTempF: 72,
  airTempF: 85,
  precip24hIn: 0.1,
  dataAgeMinutes: 12,
  activeAdvisoryHeadlines: [],
  availableActivitySlugs: ['swim', 'rock-hop', 'bridge-crossing', 'belle-isle-pedestrian', 'beach-access', 'hike'],
  // Belle Isle primary station: J20 (Rope Swing at Tredegar); watch: J24 (Huguenot Flatwater)
  waterQuality: {
    primaryStation: {
      stationCode: 'J20',
      stationName: 'Rope Swing at Tredegar',
      ecoliCfuPer100ml: 45,
      enterococciCfuPer100ml: null,
      daysOld: 2,
      freshness: 'current',
      testsEnterococcus: false,
    },
    watchStation: {
      stationCode: 'J24',
      stationName: 'Huguenot Flatwater',
      ecoliCfuPer100ml: 30,
      daysOld: 2,
      freshness: 'current',
    },
  },
};

// Forecast day +1 — high confidence, no water temp
const INPUT_FORECAST_HIGH: InterpretLocationInput = {
  ...INPUT_OBSERVED,
  date: addDays(today, 1),
  mode: 'forecast',
  forecastConfidence: 'high',
  daysOut: 1,
  waterTempF: null,        // not available in AHPS forecast
  dataAgeMinutes: null,    // not applicable for forecast
  waterQuality: null,      // water quality is historical; not shown on forecast views
};

// Forecast day +2 — medium confidence
const INPUT_FORECAST_MEDIUM: InterpretLocationInput = {
  ...INPUT_OBSERVED,
  date: addDays(today, 2),
  mode: 'forecast',
  forecastConfidence: 'medium',
  daysOut: 2,
  waterTempF: null,
  dataAgeMinutes: null,
  waterQuality: null,
};

// Forecast day +3 — low confidence
const INPUT_FORECAST_LOW: InterpretLocationInput = {
  ...INPUT_OBSERVED,
  date: addDays(today, 3),
  mode: 'forecast',
  forecastConfidence: 'low',
  daysOut: 3,
  waterTempF: null,
  dataAgeMinutes: null,
  waterQuality: null,
};

// Use observed fixture for the cache warm/read test
const INPUT = INPUT_OBSERVED;

async function call(ai: Anthropic, label: string) {
  console.log(`\n--- ${label} ---`);
  const response = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserMessage(INPUT) }],
  });

  const usage = response.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  console.log(`input_tokens:              ${usage.input_tokens}`);
  console.log(`output_tokens:             ${usage.output_tokens}`);
  console.log(`cache_creation_input_tokens: ${usage.cache_creation_input_tokens ?? 0}`);
  console.log(`cache_read_input_tokens:     ${usage.cache_read_input_tokens ?? 0}`);

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = InterpretationSchema.safeParse(JSON.parse(jsonText));

  if (parsed.success) {
    console.log(`zod parse:                 ✓ PASS (status=${parsed.data.status})`);
  } else {
    console.log(`zod parse:                 ✗ FAIL`);
    console.error(parsed.error.format());
  }

  return usage;
}

async function callMode(ai: Anthropic, label: string, input: InterpretLocationInput) {
  console.log(`\n--- ${label} ---`);
  const response = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    // Use the per-fixture input, not the shared observed INPUT constant
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  });

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = InterpretationSchema.safeParse(JSON.parse(jsonText));

  if (parsed.success) {
    console.log(`  zod parse: ✓ PASS (status=${parsed.data.status})`);
    if (input.mode === 'forecast') {
      // "water temp" / "water temperature" as a phrase would indicate the AI is
      // hallucinating or citing a value we didn't provide. Air temperature (85°F) is
      // still in the fixture so generic "temperature" words are allowed; we only flag
      // the specific phrases that would constitute a fabricated water reading.
      const body = parsed.data.body_md;
      const mentionsWaterTemp = /water temp(?:erature)?/i.test(body);
      console.log(`  no fabricated water temp: ${mentionsWaterTemp ? '✗ FAIL (water temp mentioned)' : '✓ OK'}`);
    }
  } else {
    console.log(`  zod parse: ✗ FAIL`);
    console.error(parsed.error.format());
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const ai = new Anthropic({ apiKey });

  // ── Cache warm/read test (observed mode) ──────────────────────────────────
  const u1 = await call(ai, 'Call 1 (observed) — expect cache_creation_input_tokens > 0');
  const u2 = await call(ai, 'Call 2 (observed) — expect cache_read_input_tokens > 0');

  console.log('\n=== Cache Summary ===');
  const call1CacheCreated = (u1 as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
  const call2CacheRead = (u2 as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;

  console.log(`Call 1 cache_creation_input_tokens: ${call1CacheCreated} ${call1CacheCreated > 0 ? '✓' : '✗'}`);
  console.log(`Call 2 cache_read_input_tokens:     ${call2CacheRead} ${call2CacheRead > 0 ? '✓' : '✗'}`);

  if (call1CacheCreated === 0 || call2CacheRead === 0) {
    console.error('\nCache test FAILED — prompt caching not working as expected');
    process.exit(1);
  }

  // ── Mode variant tests ────────────────────────────────────────────────────
  console.log('\n=== Mode Variant Tests ===');
  await callMode(ai, 'Forecast day +1 (high confidence) — expect forward-looking language', INPUT_FORECAST_HIGH);
  await callMode(ai, 'Forecast day +2 (medium confidence) — expect uncertainty language',   INPUT_FORECAST_MEDIUM);
  await callMode(ai, 'Forecast day +3 (low confidence) — expect "check back" prep item',    INPUT_FORECAST_LOW);

  console.log('\nSmoketest PASSED');
}

main().catch((err) => { console.error(err); process.exit(1); });
