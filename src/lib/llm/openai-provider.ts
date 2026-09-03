import OpenAI from "openai";
import { getPrompt } from "@/lib/prompt-registry";
import type { LLMProvider } from "./provider";

/**
 * The real backend. Behind the same `LLMProvider` interface as MockProvider —
 * everything downstream (schema validation, executor, role scoping) is
 * identical whether this or the mock produced the proposal.
 *
 * `temperature: 0` + `response_format: json_object` + a stable system prompt
 * from the registry. The completion is returned as raw parsed JSON (`unknown`);
 * if it isn't JSON, the raw string is returned and the pipeline refuses it.
 */

const DEFAULT_MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT_ID = "propose-query-ir@v1";

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  /** Injectable for tests — no network, no key needed. */
  client?: OpenAI;
}

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions) {
    this.client = options.client ?? new OpenAI({ apiKey: options.apiKey });
    this.model = options.model?.trim() || DEFAULT_MODEL;
  }

  async proposeQueryIR(question: string): Promise<unknown> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: getPrompt(SYSTEM_PROMPT_ID).text },
        { role: "user", content: question },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    try {
      return JSON.parse(content) as unknown;
    } catch {
      // Not JSON — hand the raw text back; the pipeline treats it as a refusal.
      return content;
    }
  }
}
