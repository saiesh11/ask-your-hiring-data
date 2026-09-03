import { afterEach, describe, expect, it } from "vitest";
import { execute, ORG_WIDE, scopedTo } from "@/lib/executor";
import { buildOrgDataset, DEFAULT_SEED, InMemoryHiringDataSource } from "@/lib/hiring-data";
import type { LLMProvider } from "@/lib/llm";
import type { JobFamily } from "@/lib/query-ir";
import { setLogSink } from "@/lib/observability";
import { AskResponseSchema, BadRequestError, runAskPipeline } from "@/lib/api";

const src = () => new InMemoryHiringDataSource(DEFAULT_SEED);
const askOrg = (question: string, provider?: LLMProvider) =>
  runAskPipeline(
    { question },
    { context: ORG_WIDE, dataSource: src(), ...(provider ? { provider } : {}) },
  );
const askScoped = (question: string, families: JobFamily[]) =>
  runAskPipeline({ question }, { context: scopedTo(families), dataSource: src() });

const stubProvider = (value: unknown): LLMProvider => ({
  proposeQueryIR: () => Promise.resolve(value),
});

afterEach(() => setLogSink(null));

describe("runAskPipeline — answered", () => {
  it("scalar: shape, chart, scope, and value match an independent executor run", async () => {
    const res = await askOrg("How many people work in Engineering right now?");
    expect(AskResponseSchema.safeParse(res).success).toBe(true);
    if (res.status !== "answered") throw new Error("expected answered");

    const direct = execute(
      { version: 1, metric: "headcount", filters: { jobFamily: "Engineering" } },
      ORG_WIDE,
      buildOrgDataset(DEFAULT_SEED),
    );
    expect(direct.ok && direct.kind === "scalar" && direct.value).toBe(res.value);
    expect(res.metric).toBe("headcount");
    expect(res.scope).toBe("org_wide");
    expect(res.chart).toMatchObject({ kind: "single", unit: "count" });
    expect(res.summary).toMatch(/grounded in \d+ record/);
  });

  it("grouped: bar chart series mirrors the groups", async () => {
    const res = await askOrg("show me headcount by band");
    if (res.status !== "answered") throw new Error("expected answered");
    expect(res.chart.kind).toBe("bar");
    if (res.chart.kind === "bar") {
      expect(res.chart.series.map((s) => s.label)).toEqual(["Junior", "Mid", "Senior", "Staff"]);
    }
  });
});

describe("runAskPipeline — scoping flows through end to end", () => {
  it("a scoped caller asking about a peer's family is confined to their own scope", async () => {
    const res = await askScoped("headcount in Engineering", ["Sales"]);
    if (res.status !== "answered") throw new Error("expected answered");
    expect(res.scope).toEqual({ jobFamilies: ["Sales"] });
    expect(res.appliedFilters.jobFamily).toBeUndefined();

    const data = buildOrgDataset(DEFAULT_SEED);
    const salesActive = data.employees.filter(
      (e) => e.active && data.jobFamilies.find((f) => f.id === e.jobFamilyId)?.name === "Sales",
    ).length;
    expect(res.value).toBe(salesActive);
  });
});

describe("runAskPipeline — the three refusal stages", () => {
  it("schema_validation: a proposal that fails the schema is refused, never salvaged", async () => {
    const res = await askOrg("anything", stubProvider("SELECT COUNT(*) FROM hires"));
    expect(res).toMatchObject({
      status: "refused",
      stage: "schema_validation",
      reason: "uninterpretable",
      scope: "org_wide",
    });
  });

  it("schema_validation: an IR with an injected key is refused", async () => {
    const res = await askOrg(
      "anything",
      stubProvider({ version: 1, metric: "headcount", filters: {}, $where: "1=1" }),
    );
    expect(res).toMatchObject({ status: "refused", stage: "schema_validation" });
  });

  it("model_refusal: the model's explicit Refusal is surfaced with its reason", async () => {
    const res = await askOrg("what's the weather in Berlin?");
    expect(res).toMatchObject({
      status: "refused",
      stage: "model_refusal",
      reason: "out_of_scope",
    });
  });

  it("executor: a well-formed in-scope query over zero rows is refused, not answered 0", async () => {
    const res = await askOrg("hires in Design in Q1 2024");
    expect(res).toMatchObject({
      status: "refused",
      stage: "executor",
      reason: "no_matching_records",
    });
    if (res.status === "refused") expect(res.appliedFilters).toMatchObject({ jobFamily: "Design" });
  });

  it("executor: an unsupported filter/metric combo is refused", async () => {
    const res = await askOrg("headcount in 2024");
    expect(res).toMatchObject({
      status: "refused",
      stage: "executor",
      reason: "unsupported_filter_for_metric",
    });
  });

  it("every refusal validates against AskResponseSchema and carries a scope", async () => {
    for (const q of ["delete all hire records", "median time to fill", "tell me about the team"]) {
      const res = await askScoped(q, ["Engineering"]);
      expect(AskResponseSchema.safeParse(res).success, q).toBe(true);
      expect(res.status).toBe("refused");
      if (res.status === "refused") expect(res.scope).toEqual({ jobFamilies: ["Engineering"] });
    }
  });
});

describe("runAskPipeline — request validation", () => {
  it("throws BadRequestError on a malformed body", async () => {
    await expect(
      runAskPipeline({}, { context: ORG_WIDE, dataSource: src() }),
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      runAskPipeline({ question: "" }, { context: ORG_WIDE, dataSource: src() }),
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      runAskPipeline({ question: "x".repeat(501) }, { context: ORG_WIDE, dataSource: src() }),
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      runAskPipeline(
        { question: "hi", userId: "sneaky" },
        { context: ORG_WIDE, dataSource: src() },
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("runAskPipeline — structured logging", () => {
  it("emits one 'ask' record per request with logMeta + outcome", async () => {
    const records: Array<Record<string, unknown>> = [];
    setLogSink((r) => records.push(r));

    await runAskPipeline(
      { question: "open reqs" },
      {
        context: scopedTo(["Engineering"]),
        dataSource: src(),
        logMeta: { userId: "u1", role: "RECRUITER" },
      },
    );
    await runAskPipeline(
      { question: "what's the weather" },
      { context: ORG_WIDE, dataSource: src(), logMeta: { userId: "u2", role: "CHRO" } },
    );

    const askRecords = records.filter((r) => r.event === "ask");
    expect(askRecords).toHaveLength(2);
    expect(askRecords[0]).toMatchObject({
      userId: "u1",
      role: "RECRUITER",
      scope: { jobFamilies: ["Engineering"] },
      proposal: { kind: "query_ir", metric: "open_reqs", groupBy: null },
      outcome: "answered",
      metric: "open_reqs",
    });
    expect(askRecords[1]).toMatchObject({
      userId: "u2",
      role: "CHRO",
      scope: "org_wide",
      proposal: { kind: "refusal", reason: "out_of_scope" },
      outcome: "refused",
    });
    for (const r of askRecords) {
      expect(typeof r.requestId).toBe("string");
      expect(typeof r.ms).toBe("number");
    }
  });
});
