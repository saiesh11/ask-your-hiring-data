import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { OpenAIProvider } from "@/lib/llm/openai-provider";
import { getPrompt } from "@/lib/prompt-registry";
import { runAskPipeline } from "@/lib/api";
import { LlmProposalSchema } from "@/lib/query-ir";

type CreateParams = {
  model: string;
  temperature: number;
  response_format: { type: string };
  messages: Array<{ role: string; content: string }>;
};

/** A fake OpenAI client whose completion content is whatever we pass in. */
function fakeClient(content: string) {
  const create = vi.fn((_params: CreateParams) =>
    Promise.resolve({ choices: [{ message: { content } }] }),
  );
  return {
    client: { chat: { completions: { create } } } as unknown as OpenAI,
    create,
  };
}

describe("OpenAIProvider", () => {
  it("calls chat.completions with temperature 0, json_object, and the registry prompt", async () => {
    const { client, create } = fakeClient('{"version":1,"metric":"headcount","filters":{}}');
    const provider = new OpenAIProvider({ apiKey: "sk-x", model: "gpt-4o", client });

    await provider.proposeQueryIR("how many people work here?");

    expect(create).toHaveBeenCalledOnce();
    const call = create.mock.calls[0];
    expect(call).toBeDefined();
    const args = call![0];
    expect(args.model).toBe("gpt-4o");
    expect(args.temperature).toBe(0);
    expect(args.response_format).toEqual({ type: "json_object" });
    expect(args.messages[0]).toEqual({
      role: "system",
      content: getPrompt("propose-query-ir@v1").text,
    });
    expect(args.messages[1]).toEqual({ role: "user", content: "how many people work here?" });
  });

  it("returns parsed JSON when the completion is valid JSON", async () => {
    const { client } = fakeClient('{"version":1,"metric":"open_reqs","filters":{}}');
    const raw = await new OpenAIProvider({ apiKey: "sk-x", client }).proposeQueryIR("q");
    expect(LlmProposalSchema.safeParse(raw).success).toBe(true);
  });

  it("returns the raw string when the completion is not JSON (pipeline will refuse it)", async () => {
    const { client } = fakeClient("I'm sorry, I can't help with that.");
    const raw = await new OpenAIProvider({ apiKey: "sk-x", client }).proposeQueryIR("q");
    expect(raw).toBe("I'm sorry, I can't help with that.");
    expect(LlmProposalSchema.safeParse(raw).success).toBe(false);
  });

  it("plugs into the pipeline: a valid IR from the model produces a grounded answer", async () => {
    const { client } = fakeClient(
      '{"version":1,"metric":"headcount","filters":{"jobFamily":"Engineering"}}',
    );
    const provider = new OpenAIProvider({ apiKey: "sk-x", client });
    const res = await runAskPipeline(
      { userId: "chro", question: "engineering headcount" },
      { provider },
    );
    expect(res.status).toBe("answered");
    if (res.status === "answered") {
      expect(res.metric).toBe("headcount");
      expect(res.appliedFilters).toEqual({ jobFamily: "Engineering" });
    }
  });

  it("plugs into the pipeline: a non-JSON completion becomes a schema_validation refusal", async () => {
    const { client } = fakeClient("no.");
    const provider = new OpenAIProvider({ apiKey: "sk-x", client });
    const res = await runAskPipeline({ userId: "chro", question: "whatever" }, { provider });
    expect(res).toMatchObject({ status: "refused", stage: "schema_validation" });
  });
});
