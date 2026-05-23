import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey } from '@/lib/env';

let _client: Anthropic | null = null;

export async function getAiClient(): Promise<Anthropic> {
  if (_client) return _client;
  const apiKey = await getAnthropicApiKey();
  _client = new Anthropic({ apiKey });
  return _client;
}

export const MODELS = {
  default: 'claude-haiku-4-5' as const,
  escalated: 'claude-sonnet-4-6' as const,
} satisfies Record<string, string>;
