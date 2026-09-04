import { describe, expect, it } from "vitest";
import {
  QUERY_IR_VERSION,
  METRICS,
  QueryIRSchema,
  OverviewIRSchema,
  RefusalSchema,
  LlmProposalSchema,
  interpretLlmProposal,
} from "@/lib/query-ir";

describe("QueryIRSchema — accepts well-formed IR", () => {
  it("minimal: version + metric + empty filters", () => {
    const result = QueryIRSchema.safeParse({ version: 1, metric: "headcount", filters: {} });
    expect(result.success).toBe(true);
  });

  it("every metric in the closed menu parses", () => {
    for (const metric of METRICS) {
      const result = QueryIRSchema.safeParse({ version: 1, metric, filters: {} });
      expect(result.success, metric).toBe(true);
    }
  });

  it("all filters + groupBy together", () => {
    const result = QueryIRSchema.safeParse({
      version: 1,
      metric: "hire_count",
      filters: {
        jobFamily: "Engineering",
        band: "Senior",
        dateRange: { from: "2024-01-01", to: "2024-03-31" },
      },
      groupBy: "band",
    });
    expect(result.success).toBe(true);
  });

  it("dateRange with from === to is allowed", () => {
    const result = QueryIRSchema.safeParse({
      version: 1,
      metric: "hire_count",
      filters: { dateRange: { from: "2024-06-01", to: "2024-06-01" } },
    });
    expect(result.success).toBe(true);
  });
});

describe("QueryIRSchema — rejects malformed / injected input (never coerced)", () => {
  const cases: Array<[string, unknown]> = [
    [
      "extra top-level key (injected field)",
      { version: 1, metric: "headcount", filters: {}, evil: "x" },
    ],
    [
      "extra key inside filters (nested injection)",
      { version: 1, metric: "headcount", filters: { hack: 1 } },
    ],
    [
      "extra key inside dateRange",
      {
        version: 1,
        metric: "hire_count",
        filters: { dateRange: { from: "2024-01-01", to: "2024-02-01", tz: "UTC" } },
      },
    ],
    ["unknown metric", { version: 1, metric: "median_time_to_fill", filters: {} }],
    ["unknown jobFamily", { version: 1, metric: "headcount", filters: { jobFamily: "Legal" } }],
    ["unknown band", { version: 1, metric: "headcount", filters: { band: "Principal" } }],
    ["unknown groupBy", { version: 1, metric: "headcount", filters: {}, groupBy: "department" }],
    ["version 2", { version: 2, metric: "headcount", filters: {} }],
    ["version as string", { version: "1", metric: "headcount", filters: {} }],
    ["missing version", { metric: "headcount", filters: {} }],
    ["missing metric", { version: 1, filters: {} }],
    ["missing filters", { version: 1, metric: "headcount" }],
    [
      "dateRange.from after dateRange.to",
      {
        version: 1,
        metric: "hire_count",
        filters: { dateRange: { from: "2024-12-01", to: "2024-01-01" } },
      },
    ],
    [
      "date not YYYY-MM-DD",
      {
        version: 1,
        metric: "hire_count",
        filters: { dateRange: { from: "2024-1-1", to: "2024-02-01" } },
      },
    ],
    [
      "date in DD-MM-YYYY order",
      {
        version: 1,
        metric: "hire_count",
        filters: { dateRange: { from: "01-01-2024", to: "02-01-2024" } },
      },
    ],
    [
      "impossible calendar date",
      {
        version: 1,
        metric: "hire_count",
        filters: { dateRange: { from: "2024-02-30", to: "2024-03-01" } },
      },
    ],
    ["raw SQL string", "SELECT COUNT(*) FROM hires"],
    ["number", 42],
    ["null", null],
    ["array wrapping a valid IR", [{ version: 1, metric: "headcount", filters: {} }]],
    ["boolean", true],
    ["metric is a nested query operator", { version: 1, metric: { $ne: null }, filters: {} }],
  ];

  it.each(cases)("rejects: %s", (_label, value) => {
    expect(QueryIRSchema.safeParse(value).success).toBe(false);
  });
});

describe("RefusalSchema", () => {
  it("accepts the explicit refusal shape", () => {
    const result = RefusalSchema.safeParse({
      refusal: true,
      reason: "out_of_scope",
      message: "That question is not about hiring data.",
    });
    expect(result.success).toBe(true);
  });

  const cases: Array<[string, unknown]> = [
    ["refusal: false", { refusal: false, reason: "out_of_scope", message: "x" }],
    ["missing message", { refusal: true, reason: "ambiguous" }],
    ["empty message", { refusal: true, reason: "ambiguous", message: "" }],
    ["unknown reason", { refusal: true, reason: "because", message: "x" }],
    ["extra key", { refusal: true, reason: "ambiguous", message: "x", detail: "y" }],
  ];

  it.each(cases)("rejects: %s", (_label, value) => {
    expect(RefusalSchema.safeParse(value).success).toBe(false);
  });
});

describe("LlmProposalSchema — the boundary raw model output hits", () => {
  it("parses a valid QueryIR", () => {
    const result = LlmProposalSchema.safeParse({ version: 1, metric: "open_reqs", filters: {} });
    expect(result.success).toBe(true);
    if (result.success) expect("refusal" in result.data).toBe(false);
  });

  it("parses a valid Refusal", () => {
    const result = LlmProposalSchema.safeParse({
      refusal: true,
      reason: "unsupported_metric",
      message: "Median time-to-fill is not supported yet.",
    });
    expect(result.success).toBe(true);
  });

  it("a QueryIR carrying an extra 'refusal' key is rejected outright (no salvage)", () => {
    const result = LlmProposalSchema.safeParse({
      version: 1,
      metric: "headcount",
      filters: {},
      refusal: true,
    });
    expect(result.success).toBe(false);
  });

  it("a bare SQL string fails", () => {
    expect(LlmProposalSchema.safeParse("SELECT COUNT(*) FROM hires").success).toBe(false);
  });
});

describe("interpretLlmProposal", () => {
  it("query_ir outcome for a valid IR", () => {
    const out = interpretLlmProposal({
      version: 1,
      metric: "headcount",
      filters: { jobFamily: "Sales" },
    });
    expect(out.kind).toBe("query_ir");
    if (out.kind === "query_ir") expect(out.queryIR.metric).toBe("headcount");
  });

  it("refusal outcome for the explicit refusal shape", () => {
    const out = interpretLlmProposal({
      refusal: true,
      reason: "ambiguous",
      message: "Which team?",
    });
    expect(out.kind).toBe("refusal");
    if (out.kind === "refusal") expect(out.refusal.reason).toBe("ambiguous");
  });

  it("invalid outcome (with issues) for a bare SQL string", () => {
    const out = interpretLlmProposal("SELECT COUNT(*) FROM hires");
    expect(out.kind).toBe("invalid");
    if (out.kind === "invalid") expect(out.issues.length).toBeGreaterThan(0);
  });

  it("invalid outcome for an object with an injected operator key", () => {
    const out = interpretLlmProposal({
      version: 1,
      metric: "headcount",
      filters: {},
      $where: "1=1",
    });
    expect(out.kind).toBe("invalid");
  });

  it("QUERY_IR_VERSION is 1", () => {
    expect(QUERY_IR_VERSION).toBe(1);
  });
});

describe("OverviewIRSchema — the broad-question proposal", () => {
  it("accepts version + overview:true + filters", () => {
    expect(OverviewIRSchema.safeParse({ version: 1, overview: true, filters: {} }).success).toBe(
      true,
    );
    expect(
      OverviewIRSchema.safeParse({
        version: 1,
        overview: true,
        filters: { jobFamily: "Engineering", dateRange: { from: "2024-01-01", to: "2024-12-31" } },
      }).success,
    ).toBe(true);
  });

  const rejects: Array<[string, unknown]> = [
    ["overview:false", { version: 1, overview: false, filters: {} }],
    [
      "a metric alongside overview",
      { version: 1, overview: true, metric: "headcount", filters: {} },
    ],
    ["an injected key", { version: 1, overview: true, filters: {}, $where: "1=1" }],
    ["missing filters", { version: 1, overview: true }],
  ];
  it.each(rejects)("rejects: %s", (_label, value) => {
    expect(OverviewIRSchema.safeParse(value).success).toBe(false);
  });

  it("LlmProposalSchema routes it, and interpretLlmProposal returns kind 'overview'", () => {
    const raw = { version: 1, overview: true, filters: { jobFamily: "Sales" } };
    expect(LlmProposalSchema.safeParse(raw).success).toBe(true);
    const out = interpretLlmProposal(raw);
    expect(out.kind).toBe("overview");
    if (out.kind === "overview") expect(out.overviewIR.filters.jobFamily).toBe("Sales");
  });

  it("an overview object with an extra key is invalid — never salvaged", () => {
    const out = interpretLlmProposal({ version: 1, overview: true, filters: {}, extra: 1 });
    expect(out.kind).toBe("invalid");
  });
});
