import { MockProvider } from "./mock-provider";
import type { LLMProvider } from "./provider";

/**
 * The single place a provider is chosen. No other module imports a provider
 * class directly — they call this.
 *
 * - `OPENAI_API_KEY` present -> the real OpenAI-backed provider.
 * - otherwise               -> the deterministic MockProvider (no key, no
 *   network — the default for the app, the tests, and the eval suite).
 */
export function getLlmProvider(env: Record<string, string | undefined> = process.env): LLMProvider {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    // TODO(step-9): return new OpenAIProvider({ apiKey, model: env.OPENAI_MODEL }).
    // "Done" = an OpenAI SDK-backed provider behind this same interface, unit-
    // tested with a mocked client. Until then, fail loudly rather than silently
    // downgrading a caller who set a key expecting the real model.
    throw new Error(
      "OPENAI_API_KEY is set, but OpenAIProvider is not wired up yet (build step 9). " +
        "Unset OPENAI_API_KEY to run on the deterministic MockProvider.",
    );
  }
  return new MockProvider();
}
