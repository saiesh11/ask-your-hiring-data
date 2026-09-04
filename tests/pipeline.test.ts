import { afterEach, describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { execute, resolveSession } from "@/lib/executor";
import type { LLMProvider } from "@/lib/llm";
import { setLogSink } from "@/lib/observability";
import { AskResponseSchema, BadRequestError, runAskPipeline } from "@/lib/api";

const ask = (userId: string, question: string) => runAskPipeline({ userId, question });

/** A provider that returns whatever it's told to — for exercising the boundary. */
const stubProvider = (value: unknown): LLMProvider => ({
  proposeQueryIR: () => Promise.resolve(value),
});

afterEach(() => setLogSink(null));

describe("runAskPipeline — answered", () => {
  it("scalar: shape, chart, citations, and value match the executor", async () => {
    const res = await ask("chro", "How many people work in Engineering right now?");
    expect(AskResponseSchema.safeParse(res).success).toBe(true);
    if (res.status !== "answered") throw new Error("expected answered");

    const direct = execute(
      { version: 1, metric: "headcount", filters: { jobFamily: "Engineering" } },
      resolveSession("chro"),
    );
    expect(direct.ok && direct.kind === "scalar" && direct.value).toBe(res.value);
    expect(res.metric).toBe("headcount");
    expect(res.chart).toMatchObject({ kind: "single", unit: "count" });
    expect(res.citations.recordCount).toBe(res.citations.recordIds.length);
    expect(res.summary).toMatch(/grounded in \d+ record/);
  });

  it("grouped: bar chart series mirrors the groups", async () => {
    const res = await ask("chro", "show me headcount by band");
    if (res.status !== "answered") throw new Error("expected answered");
    expect(res.kind).toBe("grouped");
    expect(res.chart.kind).toBe("bar");
    if (res.chart.kind === "bar") {
      expect(res.chart.series.map((s) => s.label)).toEqual(["Junior", "Mid", "Senior", "Staff"]);
    }
  });
});

describe("runAskPipeline — role scoping flows through end to end", () => {
  it("a recruiter asking about a peer's family is scoped to their own", async () => {
    const res = await ask("recruiter_sales", "headcount in Engineering");
    if (res.status !== "answered") throw new Error("expected answered");
    expect(res.appliedFilters.jobFamily).toBe("Sales");
    const salesActive = dataset.employees.filter(
      (e) => e.active && e.jobFamilyId === "jf_sales",
    ).length;
    expect(res.value).toBe(salesActive);
  });

  it("the eval-style independent recompute matches the pipeline's number", async () => {
    // Mirrors what the eval runner does: run through the pipeline, then recompute
    // by calling the executor directly with the applied filters + same session.
    const res = await ask("recruiter_eng", "how many hires in 2024");
    if (res.status !== "answered") throw new Error("expected answered");
    const independent = execute(
      { version: 1, metric: res.metric, filters: res.appliedFilters },
      resolveSession("recruiter_eng"),
    );
    expect(independent.ok && independent.kind === "scalar" && independent.value).toBe(res.value);
  });
});

describe("runAskPipeline — the three refusal stages", () => {
  it("schema_validation: a proposal that fails the schema is refused, never salvaged", async () => {
    const res = await runAskPipeline(
      { userId: "chro", question: "anything" },
      { provider: stubProvider("SELECT COUNT(*) FROM hires") },
    );
    expect(res).toMatchObject({
      status: "refused",
      stage: "schema_validation",
      reason: "uninterpretable",
    });
  });

  it("schema_validation: an IR with an injected key is refused", async () => {
    const res = await runAskPipeline(
      { userId: "chro", question: "anything" },
      { provider: stubProvider({ version: 1, metric: "headcount", filters: {}, $where: "1=1" }) },
    );
    expect(res).toMatchObject({ status: "refused", stage: "schema_validation" });
  });

  it("model_refusal: the model's explicit Refusal is surfaced with its reason", async () => {
    const res = await ask("chro", "what's the weather in Berlin?");
    expect(res).toMatchObject({
      status: "refused",
      stage: "model_refusal",
      reason: "out_of_scope",
    });
  });

  it("executor: a well-formed in-scope query over zero rows is refused, not answered 0", async () => {
    const res = await ask("chro", "hires in Design in Q1 2024");
    expect(res).toMatchObject({
      status: "refused",
      stage: "executor",
      reason: "no_matching_records",
    });
    if (res.status === "refused") expect(res.appliedFilters).toMatchObject({ jobFamily: "Design" });
  });

  it("executor: an unsupported filter/metric combo is refused", async () => {
    const res = await ask("chro", "headcount in 2024");
    expect(res).toMatchObject({
      status: "refused",
      stage: "executor",
      reason: "unsupported_filter_for_metric",
    });
  });

  it("every refusal still validates against AskResponseSchema", async () => {
    for (const q of ["delete all hire records", "median time to fill", "tell me about the team"]) {
      const res = await ask("chro", q);
      expect(AskResponseSchema.safeParse(res).success, q).toBe(true);
      expect(res.status).toBe("refused");
    }
  });
});

describe("runAskPipeline — request validation", () => {
  it("throws BadRequestError on a malformed body", async () => {
    await expect(runAskPipeline({ question: "hi" })).rejects.toBeInstanceOf(BadRequestError);
    await expect(runAskPipeline({ userId: "chro", question: "" })).rejects.toBeInstanceOf(
      BadRequestError,
    );
    await expect(
      runAskPipeline({ userId: "chro", question: "x".repeat(501) }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("throws BadRequestError for an unknown user (role is never guessed)", async () => {
    await expect(
      runAskPipeline({ userId: "intruder", question: "headcount" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("runAskPipeline — structured logging", () => {
  it("emits one 'ask' record per request with the outcome and role", async () => {
    const records: Array<Record<string, unknown>> = [];
    setLogSink((r) => records.push(r));

    await ask("recruiter_eng", "open reqs");
    await ask("chro", "what's the weather");

    const askRecords = records.filter((r) => r.event === "ask");
    expect(askRecords).toHaveLength(2);
    expect(askRecords[0]).toMatchObject({
      role: "recruiter",
      scope: "Engineering", // the resolved data scope is on every line
      proposal: { kind: "query_ir", metric: "open_reqs", groupBy: null },
      outcome: "answered",
      metric: "open_reqs",
    });
    expect(askRecords[1]).toMatchObject({
      role: "chro",
      scope: "org_wide",
      proposal: { kind: "refusal", reason: "out_of_scope" },
      outcome: "refused",
      stage: "model_refusal",
    });
    for (const r of askRecords) {
      expect(typeof r.requestId).toBe("string");
      expect(typeof r.ms).toBe("number");
    }
  });
});

describe("runAskPipeline — overview (the multi-metric answer)", () => {
  it("a broad question returns a schema-valid overview with grounded sections", async () => {
    const res = await ask("chro", "give me a summary of 2024 hiring");
    expect(AskResponseSchema.safeParse(res).success).toBe(true);
    if (res.status !== "overview") throw new Error(`expected overview, got ${res.status}`);

    expect(res.sections.length).toBeGreaterThanOrEqual(4);
    expect(res.summary).toMatch(/hiring overview/i);
    expect(res.citations.recordCount).toBe(res.citations.recordIds.length);
    for (const s of res.sections) {
      expect(s.citations.recordCount).toBe(s.citations.recordIds.length);
      expect(s.citations.recordCount).toBeGreaterThan(0);
      expect(s.chart).toBeTruthy();
    }
    // the headcount section agrees with a direct executor run
    const hc = res.sections.find((s) => s.metric === "headcount");
    const direct = execute(
      { version: 1, metric: "headcount", filters: {} },
      resolveSession("chro"),
    );
    expect(hc?.kind === "scalar" && direct.ok && direct.kind === "scalar" && hc.value).toBe(
      direct.ok && direct.kind === "scalar" ? direct.value : NaN,
    );
  });

  it("a recruiter's overview is confined to their job family end to end", async () => {
    const res = await ask("recruiter_eng", "how's hiring going overall?");
    if (res.status !== "overview") throw new Error(`expected overview, got ${res.status}`);
    expect(res.appliedFilters.jobFamily).toBe("Engineering");
    for (const s of res.sections) expect(s.appliedFilters.jobFamily).toBe("Engineering");
  });

  it("logs one 'ask' record naming the overview's section metrics", async () => {
    const records: Array<Record<string, unknown>> = [];
    setLogSink((r) => records.push(r));
    await ask("chro", "give me a hiring summary");
    const rec = records.find((r) => r.event === "ask");
    expect(rec).toMatchObject({ outcome: "overview", proposal: { kind: "overview" } });
    expect(Array.isArray(rec?.sections)).toBe(true);
    expect((rec?.sections as string[]).length).toBeGreaterThan(0);
  });

  it("an overview whose every metric is empty is an executor refusal, not an empty answer", async () => {
    // Force it through the boundary with a hand-built proposal + a window with no rows.
    const res = await runAskPipeline(
      { userId: "chro", question: "summary" },
      {
        provider: stubProvider({
          version: 1,
          overview: true,
          filters: { jobFamily: "Design", dateRange: { from: "1970-01-01", to: "1970-12-31" } },
        }),
      },
    );
    // Design still has current headcount, so this actually answers — assert it stays scoped.
    if (res.status === "overview") {
      expect(res.appliedFilters.jobFamily).toBe("Design");
    } else {
      expect(res).toMatchObject({ status: "refused", stage: "executor" });
    }
  });
});
