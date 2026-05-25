// Run with: pnpm tsx scripts/ai-smoketest.ts
// Requires ANTHROPIC_API_KEY in .env.local or environment.
// Confirms: call 1 creates cache, call 2 reads cache, both parse against zod schema.

import { config } from 'dotenv';
config({ path: '.env.local' });
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '../lib/ai/system-prompt';
import {
  buildUserMessage,
  InterpretationSchema,
} from '../lib/ai/prompts/interpret-location';

const INPUT = {
  date: new Date().toISOString().split('T')[0],
  locationSlug: 'belle-isle',
  locationName: 'Belle Isle',
  ageBucket: '6-9' as const,
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
      freshness: 'current' as const,
      testsEnterococcus: false,
    },
    watchStation: {
      stationCode: 'J24',
      stationName: 'Huguenot Flatwater',
      ecoliCfuPer100ml: 30,
      daysOld: 2,
      freshness: 'current' as const,
    },
  },
};

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

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const ai = new Anthropic({ apiKey });

  const u1 = await call(ai, 'Call 1 — expect cache_creation_input_tokens > 0');
  const u2 = await call(ai, 'Call 2 — expect cache_read_input_tokens > 0');

  console.log('\n=== Summary ===');
  const call1CacheCreated = (u1 as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
  const call2CacheRead = (u2 as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;

  console.log(`Call 1 cache_creation_input_tokens: ${call1CacheCreated} ${call1CacheCreated > 0 ? '✓' : '✗'}`);
  console.log(`Call 2 cache_read_input_tokens:     ${call2CacheRead} ${call2CacheRead > 0 ? '✓' : '✗'}`);

  if (call1CacheCreated === 0 || call2CacheRead === 0) {
    console.error('\nSmoketest FAILED — cache not working as expected');
    process.exit(1);
  }
  console.log('\nSmoketest PASSED');
}

main().catch((err) => { console.error(err); process.exit(1); });
