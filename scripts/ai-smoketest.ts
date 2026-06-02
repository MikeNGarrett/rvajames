// Run with: pnpm tsx scripts/ai-smoketest.ts
// Requires ANTHROPIC_API_KEY in .env.development.local or environment.
// Confirms: call 1 creates cache, call 2 reads cache, both parse against zod schema.
// Also exercises 3 mode/confidence variants to confirm forecast language rules are applied.

import { config } from 'dotenv';
// override: true so .env.development.local always wins over any pre-existing
// process.env value (e.g. an empty ANTHROPIC_API_KEY injected by the agent runtime
// would otherwise block the parsed value from being written — dotenv's default
// is to never clobber).
config({ path: '.env.development.local', override: true });
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '../lib/ai/system-prompt';
import {
  buildUserMessage,
  InterpretationSchema,
  type InterpretLocationInput,
} from '../lib/ai/prompts/interpret-location';
import {
  buildMetroUserMessage,
  MetroSummaryWriteSchema,
  type MetroSummaryInput,
} from '../lib/ai/prompts/summarize-metro';

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
  upstreamCso: null,
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

// CSO active — 2 upstream overflows, most recent ~6h ago (count-only, no IDs).
// Expect body_md to mention CSO and caution language.
// Expect body_md to NOT contain "CSO 34", "CSO 12", or similar outfall IDs.
const INPUT_CSO_ACTIVE: InterpretLocationInput = {
  ...INPUT_OBSERVED,
  locationSlug: 'pony-pasture',
  locationName: 'Pony Pasture Rapids',
  activeAdvisoryHeadlines: ['Active combined sewer overflow advisory — bacterial contamination elevated'],
  upstreamCso: {
    count: 2,
    mostRecentAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
  },
};

// CSO inactive — no upstream CSO at all.
// Expect body_md to NOT mention "combined sewer" or "CSO".
const INPUT_CSO_INACTIVE: InterpretLocationInput = {
  ...INPUT_OBSERVED,
  locationSlug: 'pony-pasture',
  locationName: 'Pony Pasture Rapids',
  upstreamCso: null,
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
      if (mentionsWaterTemp) {
        // Surface the offending sentence so prompt tightening vs. test
        // relaxing can be decided from the actual AI phrasing — not
        // guesswork. Show ±60 chars around the first match.
        const m = body.match(/.{0,60}water temp(?:erature)?[^.]{0,80}\.?/i);
        if (m) console.log(`  offending phrase:        "…${m[0].trim()}…"`);
      }
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

  // ── CSO variant tests ─────────────────────────────────────────────────────
  console.log('\n=== CSO Variant Tests ===');

  // ── CSO topic detector ────────────────────────────────────────────────────
  // The AI talks about CSO events in plain language — sometimes "CSO," sometimes
  // "combined sewer overflow," "sewer overflow," "sewage overflow," or
  // "wastewater discharge." The acronym is rare in AI output (it's jargon);
  // synonym phrases dominate. Match the broader family of phrasings.
  //
  // Distinguishes ACTIVE mention from NEGATED mention. The AI may helpfully
  // volunteer "no sewer overflows in the past 48 hours" in the inactive case
  // — that's reassuring UX, not a spurious mention. We only flag positive-
  // tense references that imply a real event.
  const CSO_TOPIC_GLOBAL = /\bCSO\b|combined sewer|sewer overflow|sewage overflow|wastewater (discharge|overflow)/gi;
  const NEGATION = /\b(no|none|without|absent|zero|haven't|have not|free of|clear of|no recent|no active)\b/i;

  function hasActiveCsoMention(text: string): boolean {
    let m: RegExpExecArray | null;
    const re = new RegExp(CSO_TOPIC_GLOBAL.source, 'gi'); // fresh state per call
    while ((m = re.exec(text)) !== null) {
      // ±60 chars window around each match; if negation precedes within
      // 30 chars, treat as a "no CSO" mention rather than a real one.
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      if (!NEGATION.test(before)) return true;
    }
    return false;
  }

  // Negative assertion: AI must NEVER emit outfall IDs like "CSO 34", "CSO 12".
  const OUTFALL_ID = /CSO\s*\d+/i;

  // Active CSO: expect body_md mentions the CSO topic + caution language
  console.log('\n--- CSO Active (2 upstream events) ---');
  const csoActiveResponse = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(INPUT_CSO_ACTIVE) }],
  });
  const csoActiveText = csoActiveResponse.content[0]?.type === 'text' ? csoActiveResponse.content[0].text : '';
  const csoActiveJson = csoActiveText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const csoActiveParsed = InterpretationSchema.safeParse(JSON.parse(csoActiveJson));
  if (csoActiveParsed.success) {
    const body = csoActiveParsed.data.body_md;
    const mentionsCso     = hasActiveCsoMention(body);
    const mentionsCaution = /caution|avoid|elevated|bacteria/i.test(body);
    const mentionsOutfallId = OUTFALL_ID.test(body);
    console.log(`  zod parse:           ✓ PASS (status=${csoActiveParsed.data.status})`);
    console.log(`  mentions CSO topic:  ${mentionsCso ? '✓ OK' : '✗ FAIL (no CSO/sewer/wastewater mention)'}`);
    console.log(`  mentions caution:    ${mentionsCaution ? '✓ OK' : '✗ FAIL (no caution language)'}`);
    console.log(`  no outfall ID:       ${mentionsOutfallId ? '✗ FAIL (outfall ID in output)' : '✓ OK'}`);
    console.log(`  body_md excerpt:     "${body.slice(0, 200).replace(/\n/g, ' ')}..."`);
    if (!mentionsCso || !mentionsCaution || mentionsOutfallId) {
      console.error('CSO active test FAILED — expected CSO topic + caution, no outfall IDs in body_md');
      process.exit(1);
    }
  } else {
    console.log(`  zod parse:           ✗ FAIL`);
    console.error(csoActiveParsed.error.format());
    process.exit(1);
  }

  // Inactive CSO: expect body_md does NOT mention the CSO topic
  console.log('\n--- CSO Inactive (null) ---');
  const csoInactiveResponse = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(INPUT_CSO_INACTIVE) }],
  });
  const csoInactiveText = csoInactiveResponse.content[0]?.type === 'text' ? csoInactiveResponse.content[0].text : '';
  const csoInactiveJson = csoInactiveText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const csoInactiveParsed = InterpretationSchema.safeParse(JSON.parse(csoInactiveJson));
  if (csoInactiveParsed.success) {
    const body = csoInactiveParsed.data.body_md;
    // hasActiveCsoMention skips negation-context matches ("no sewer
    // overflows in past 48h") — those are reassuring affirmations of
    // safety, not spurious topic injection. We flag a "spurious" mention
    // only when the AI invents an event that wasn't in the per-call input.
    const spuriousCsoMention = hasActiveCsoMention(body);
    const mentionsOutfallId  = OUTFALL_ID.test(body);
    console.log(`  zod parse:           ✓ PASS (status=${csoInactiveParsed.data.status})`);
    console.log(`  no spurious CSO:     ${spuriousCsoMention ? '✗ FAIL (CSO topic mentioned when it should not be)' : '✓ OK'}`);
    console.log(`  no outfall ID:       ${mentionsOutfallId ? '✗ FAIL (outfall ID in output)' : '✓ OK'}`);
    if (spuriousCsoMention || mentionsOutfallId) {
      console.error('CSO inactive test FAILED — model mentioned CSO topic or outfall ID when upstream_cso is null');
      console.error('body_md:', body);
      process.exit(1);
    }
  } else {
    console.log(`  zod parse:           ✗ FAIL`);
    console.error(csoInactiveParsed.error.format());
    process.exit(1);
  }

  // ─── Metro summary pass — Richmond microcopy (b3) ─────────────────────────
  // Added in sub-goal 89. Verifies fresh AI output includes the new
  // richmond_microcopy field within the 20-180 char schema bounds and
  // doesn't echo any of the deterministic headline phrases verbatim
  // (a regression that would happen if the system-prompt's "DO NOT
  // repeat the deterministic headline" guidance gets ignored).
  console.log('\n--- Metro summary (Richmond microcopy b3) ---');
  // buildMetroUserMessage only reads a subset of MetroRiverState fields
  // (upriver.gageFt / dischargeCfs / waterTempF, downriver.gageFt,
  // lastUpdatedAt). The full GaugeReading shape includes locationId, slug,
  // stationId etc. that the prompt doesn't touch — cast to keep the
  // synthetic fixture minimal.
  const METRO_INPUT: MetroSummaryInput = {
    date:                    today,
    ageBucket:               '6-9',
    metroState: {
      upriver:   { gageFt: 3.6, dischargeCfs: 1050, waterTempF: 74 },
      downriver: { gageFt: 1.0, dischargeCfs: null, waterTempF: null },
      lastUpdatedAt: new Date().toISOString(),
    } as unknown as MetroSummaryInput['metroState'],
    activeAdvisoryHeadlines: [],
    airTempF:                85,
    mode:                    'observed',
    forecastConfidence:      null,
    daysOut:                 0,
    rain48hIn:               0,
    activeCSOAdvisory:       false,
    hasHighSeverityAdvisory: false,
    activeClosures:          [],
    cso: {
      activelyDischarging:      { count: 0 },
      advisoriesOnSelectedDate: { count: 0, windowEndsAt: null },
    },
  };
  const metroResp = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildMetroUserMessage(METRO_INPUT) }],
  });
  const metroText = metroResp.content[0]?.type === 'text' ? metroResp.content[0].text : '';
  const metroJson = metroText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const metroParsed = MetroSummaryWriteSchema.safeParse(JSON.parse(metroJson));
  if (!metroParsed.success) {
    console.log('  zod parse:             ✗ FAIL');
    console.error(metroParsed.error.format());
    process.exit(1);
  }
  const mc = metroParsed.data.richmond_microcopy;
  console.log(`  zod parse:             ✓ PASS (richmond_microcopy ${mc.length} chars)`);
  console.log(`  microcopy text:        "${mc}"`);

  // Headline-leakage guard — microcopy must not start with a deterministic headline phrase.
  const HEADLINES = [
    'Stay home today', 'Heat alert', 'Hot day', 'Tough conditions', 'OK day',
    'Fair day', 'Decent day', 'Solid day', 'Good day', 'Great day',
  ];
  const leakage = HEADLINES.find((h) => mc.toLowerCase().startsWith(h.toLowerCase()));
  if (leakage) {
    console.error(`  ✗ FAIL — microcopy starts with the headline phrase "${leakage}"`);
    process.exit(1);
  }
  console.log('  no headline leakage:   ✓ OK');

  console.log('\nSmoketest PASSED');
}

main().catch((err) => { console.error(err); process.exit(1); });
