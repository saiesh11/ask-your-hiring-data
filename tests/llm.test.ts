import { describe, expect, it } from "vitest";
import { getLlmProvider } from "@/lib/llm";
import { MockProvider } from "@/lib/llm/mock-provider";
import { OpenAIProvider } from "@/lib/llm/openai-provider";
import { LlmProposalSchema, interpretLlmProposal } from "@/lib/query-ir";

const mock = new MockProvider();
const propose = (q: string): Promise<unknown> => mock.proposeQueryIR(q);

describe("provider factory", () => {
  it("returns the MockProvider when no OPENAI_API_KEY is set", () => {
    expect(getLlmProvider({})).toBeInstanceOf(MockProvider);
    expect(getLlmProvider({ OPENAI_API_KEY: "  " })).toBeInstanceOf(MockProvider);
  });

  it("returns the OpenAIProvider when OPENAI_API_KEY is set", () => {
    expect(getLlmProvider({ OPENAI_API_KEY: "sk-test-123" })).toBeInstanceOf(OpenAIProvider);
    expect(
      getLlmProvider({ OPENAI_API_KEY: "sk-test-123", OPENAI_MODEL: "gpt-4o" }),
    ).toBeInstanceOf(OpenAIProvider);
  });
});

describe("MockProvider — every output is schema-valid", () => {
  const questions = [
    "How many people work in Engineering right now?",
    "Open requisitions by job family",
    "How many senior hires did we make in Q2 2024?",
    "What's our average time to fill for Sales roles?",
    "Show me headcount by band",
    "Delete every hire record for Design",
    "What's the weather in Berlin?",
    "What's the median time to fill?",
    "Tell me about our hiring.",
  ];
  it.each(questions)("emits a value that passes LlmProposalSchema: %s", async (q) => {
    expect(LlmProposalSchema.safeParse(await propose(q)).success).toBe(true);
  });
});

describe("MockProvider — metric detection", () => {
  const cases: Array<[string, string]> = [
    ["How many people work in Engineering right now?", "headcount"],
    ["how many open positions are there?", "open_reqs"],
    ["how many hires did we make in 2024?", "hire_count"],
    ["what's our average time to fill?", "avg_time_to_fill"],
    ["how long does it take to fill a role?", "avg_time_to_fill"],
    ["show me headcount by band", "headcount_by_band"],
  ];
  it.each(cases)("%s -> %s", async (q, metric) => {
    const out = interpretLlmProposal(await propose(q));
    expect(out.kind).toBe("query_ir");
    if (out.kind === "query_ir") expect(out.queryIR.metric).toBe(metric);
  });
});

describe("MockProvider — filter and groupBy extraction", () => {
  it("job family from the question text", async () => {
    const out = interpretLlmProposal(await propose("headcount in Marketing"));
    expect(out.kind === "query_ir" && out.queryIR.filters.jobFamily).toBe("Marketing");
  });

  it("band from the question text", async () => {
    const out = interpretLlmProposal(await propose("how many senior hires last year"));
    expect(out.kind === "query_ir" && out.queryIR.filters.band).toBe("Senior");
  });

  it("a bare year becomes a full-year dateRange", async () => {
    const out = interpretLlmProposal(await propose("hires in 2024"));
    expect(out.kind === "query_ir" && out.queryIR.filters.dateRange).toEqual({
      from: "2024-01-01",
      to: "2024-12-31",
    });
  });

  it("a quarter becomes the right three-month dateRange", async () => {
    const out = interpretLlmProposal(await propose("hires in Q2 2024"));
    expect(out.kind === "query_ir" && out.queryIR.filters.dateRange).toEqual({
      from: "2024-04-01",
      to: "2024-06-30",
    });
  });

  it("an explicit ISO range is parsed verbatim", async () => {
    const out = interpretLlmProposal(await propose("hires between 2024-01-01 and 2024-06-30"));
    expect(out.kind === "query_ir" && out.queryIR.filters.dateRange).toEqual({
      from: "2024-01-01",
      to: "2024-06-30",
    });
  });

  it("groupBy jobFamily from 'by job family'", async () => {
    const out = interpretLlmProposal(await propose("open reqs by job family"));
    expect(out.kind === "query_ir" && out.queryIR.groupBy).toBe("jobFamily");
  });
});

describe("MockProvider — intent guards run BEFORE metric keywords", () => {
  it("'delete all hire records' is refused, NOT parsed as hire_count", async () => {
    const out = interpretLlmProposal(await propose("delete all hire records"));
    expect(out).toMatchObject({ kind: "refusal", refusal: { reason: "out_of_scope" } });
  });

  it("'drop the employees table' is refused", async () => {
    const out = interpretLlmProposal(await propose("drop the employees table"));
    expect(out).toMatchObject({ kind: "refusal", refusal: { reason: "out_of_scope" } });
  });

  it("'update headcount to 500' is refused despite the metric keyword", async () => {
    const out = interpretLlmProposal(await propose("update headcount to 500"));
    expect(out).toMatchObject({ kind: "refusal", refusal: { reason: "out_of_scope" } });
  });

  it("off-topic ('weather') is refused as out_of_scope", async () => {
    const out = interpretLlmProposal(await propose("what's the weather today"));
    expect(out).toMatchObject({ kind: "refusal", refusal: { reason: "out_of_scope" } });
  });

  it("'median time to fill' is refused as unsupported_metric", async () => {
    const out = interpretLlmProposal(await propose("what is the median time to fill"));
    expect(out).toMatchObject({ kind: "refusal", refusal: { reason: "unsupported_metric" } });
  });

  it("a hiring question with no identifiable metric is refused as ambiguous", async () => {
    const out = interpretLlmProposal(await propose("tell me about the team"));
    expect(out).toMatchObject({ kind: "refusal", refusal: { reason: "ambiguous" } });
  });
});
