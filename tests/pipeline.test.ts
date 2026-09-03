import { afterEach, describe, expect, it } from "vitest";
import { buildOrgDataset } from "@/lib/hiring-data";
import { execute } from "@/lib/executor";
import type { LLMProvider } from "@/lib/llm";
import { setLogSink } from "@/lib/observability";
import { AskResponseSchema, BadRequestError, resolveDevPrincipal, runAskPipeline } from "@/lib/api";

const ask = (userId: string, question: string) => runAskPipeline({ userId, question });

const stubProvider = (value: unknown): LLMProvider => ({
  proposeQueryIR: () => Promise.resolve(value),
});

afterEach(() => setLogSink(null));

describe("runAskPipeline — answered", () => {
  it("scalar: shape, chart, citations, and value match an independent executor run", async () => {
    const res = await ask("chro", "How many people work in Engineering right now?");
    expect(AskResponseSchema.safeParse(res).success).toBe(true);
    if (res.status !== "answered") throw new Error("expected answered");

    const principal = resolveDevPrincipal("chro");
    const direct = execute(
      { version: 1, metric: "headcount", filters: { jobFamily: "Engineering" } },
      principal.context,
      buildOrgDataset(principal.seed),
    );
    expect(direct.ok && direct.kind === "scalar" && direct.value).toBe(res.value);
    expect(res.metric).toBe("headcount");
    expect(res.scope).toBe("org_wide");
    expect(res.chart).toMatchObject({ kind: "single", unit: "count" });
    expect(res.summary).toMatch(/grounded in \d+ record/);
  });

  it("grouped: bar chart series mirrors the groups", async () => {
    const res = await ask("chro", "show me headcount by band");
    if (res.status !== "answered") throw new Error("expected answered");
    expect(res.chart.kind).toBe("bar");
    if (res.chart.kind === "bar") {
      expect(res.chart.series.map((s) => s.label)).toEqual(["Junior", "Mid", "Senior", "Staff"]);
    }
  });
});

describe("runAskPipeline — scoping flows through end to end", () => {
  it("a recruiter asking about a peer's family is confined to their own scope", async () => {
    const res = await ask("recruiter_sales", "headcount in Engineering");
    if (res.status !== "answered") throw new Error("expected answered");
    expect(res.scope).toEqual({ jobFamilies: ["Sales"] });
    expect(res.appliedFilters.jobFamily).toBeUndefined();

    const data = buildOrgDataset(resolveDevPrincipal("recruiter_sales").seed);
    const salesActive = data.employees.filter(
      (e) => e.active && data.jobFamilies.find((f) => f.id === e.jobFamilyId)?.name === "Sales",
    ).length;
    expect(res.value).toBe(salesActive);
  });

  it("the eval-style independent recompute matches the pipeline's number", async () => {
    const res = await ask("recruiter_eng", "how many hires in 2024");
    if (res.status !== "answered") throw new Error("expected answered");
    const principal = resolveDevPrincipal("recruiter_eng");
    const independent = execute(
      { version: 1, metric: res.metric, filters: res.appliedFilters },
      principal.context,
      buildOrgDataset(principal.seed),
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
      scope: "org_wide",
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

  it("every refusal validates against AskResponseSchema and carries a scope", async () => {
    for (const q of ["delete all hire records", "median time to fill", "tell me about the team"]) {
      const res = await ask("recruiter_eng", q);
      expect(AskResponseSchema.safeParse(res).success, q).toBe(true);
      expect(res.status).toBe("refused");
      if (res.status === "refused") expect(res.scope).toEqual({ jobFamilies: ["Engineering"] });
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

  it("throws BadRequestError for an unknown user", async () => {
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
    expect(askRecords[0]).toMatchObject({ role: "RECRUITER", outcome: "answered" });
    expect(askRecords[1]).toMatchObject({
      role: "CHRO",
      outcome: "refused",
      stage: "model_refusal",
    });
    for (const r of askRecords) {
      expect(typeof r.requestId).toBe("string");
      expect(typeof r.ms).toBe("number");
    }
  });
});
