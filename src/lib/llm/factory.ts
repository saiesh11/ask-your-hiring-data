import { MockProvider } from "./mock-provider";
import { OpenAIProvider } from "./openai-provider";
import type { LLMProvider } from "./provider";

/**
 * The single place a provider is chosen. No other module imports a provider
 * class directly — they call this.
 *
 * - `OPENAI_API_KEY` present -> the real OpenAI-backed provider (model from
 *   `OPENAI_MODEL`, else a sane default).
 * - otherwise               -> the deterministic MockProvider (no key, no
 *   network — the default for the app, the tests, and the eval suite).
 */
export function getLlmProvider(env: Record<string, string | undefined> = process.env): LLMProvider {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    return new OpenAIProvider({ apiKey, model: env.OPENAI_MODEL });
  }
  return new MockProvider();
}
