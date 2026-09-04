import { describe, expect, it } from "vitest";
import { buildOrgDataset } from "@/lib/hiring-data";
import type { QueryIR } from "@/lib/query-ir";
import {
  execute,
  executeOverview,
  ORG_WIDE,
  resolveScope,
  scopedTo,
  type ExecutionContext,
  type ExecutorResult,
  type GroupedAnswer,
  type ScalarAnswer,
} from "@/lib/executor";

const data = buildOrgDataset(); // DEFAULT_SEED = 42
const familyName = new Map(data.jobFamilies.map((f) => [f.id, f.name] as const));
const bandName = new Map(data.bands.map((b) => [b.id, b.name] as const));
const fam = (id: string): string => familyName.get(id) ?? "?";
const bnd = (id: string): string => bandName.get(id) ?? "?";
const days = (from: string, to: string): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

const ir = (
  metric: QueryIR["metric"],
  filters: QueryIR["filters"] = {},
  groupBy?: QueryIR["groupBy"],
): QueryIR => ({ version: 1, metric, filters, ...(groupBy ? { groupBy } : {}) });

const run = (query: QueryIR, ctx: ExecutionContext): ExecutorResult => execute(query, ctx, data);

function asScalar(result: ExecutorResult): ScalarAnswer {
  if (!result.ok || result.kind !== "scalar") {
    throw new Error(`expected scalar, got ${JSON.stringify(result)}`);
  }
  return result;
}
function asGrouped(result: ExecutorResult): GroupedAnswer {
  if (!result.ok || result.kind !== "grouped") {
    throw new Error(`expected grouped, got ${JSON.stringify(result)}`);
  }
  return result;
}

describe("resolveScope — the security boundary", () => {
  it("org-wide: no constraint, the IR's family passes through", () => {
    expect(resolveScope(ORG_WIDE, "Sales")).toEqual({
      allowedFamilies: null,
      effectiveJobFamily: "Sales",
      orgScope: "org_wide",
    });
  });

  it("scoped, asking within scope: narrowed to that one family", () => {
    expect(resolveScope(scopedTo(["Sales", "Engineering"]), "Engineering")).toEqual({
      allowedFamilies: ["Engineering"],
      effectiveJobFamily: "Engineering",
      orgScope: { jobFamilies: ["Engineering"] },
    });
  });

  it("scoped, asking OUTSIDE scope: silently confined to the whole scope", () => {
    expect(resolveScope(scopedTo(["Sales"]), "Engineering")).toEqual({
      allowedFamilies: ["Sales"],
      effectiveJobFamily: undefined,
      orgScope: { jobFamilies: ["Sales"] },
    });
  });

  it("scoped, no family requested: confined to the whole scope", () => {
    expect(resolveScope(scopedTo(["Sales", "Engineering"]), undefined).allowedFamilies).toEqual([
      "Sales",
      "Engineering",
    ]);
  });
});

describe("metrics — executor output equals a naive recompute from the generated data", () => {
  it("headcount = active employees (org-wide and family-filtered)", () => {
    const orgExpected = data.employees.filter((e) => e.active).length;
    expect(asScalar(run(ir("headcount"), ORG_WIDE)).value).toBe(orgExpected);
    expect(orgExpected).toBe(49);

    const engExpected = data.employees.filter(
      (e) => e.active && fam(e.jobFamilyId) === "Engineering",
    ).length;
    const res = asScalar(run(ir("headcount", { jobFamily: "Engineering" }), ORG_WIDE));
    expect(res.value).toBe(engExpected);
    expect(res.scope).toBe("org_wide");
    expect(res.appliedFilters).toEqual({ jobFamily: "Engineering" });
  });

  it("open_reqs = jobs with status 'open'", () => {
    const expected = data.jobs.filter((j) => j.status === "open").length;
    expect(asScalar(run(ir("open_reqs"), ORG_WIDE)).value).toBe(expected);
    expect(expected).toBe(18);
  });

  it("hire_count = employees hired within the dateRange", () => {
    const range = { from: "2024-01-01", to: "2024-12-31" };
    const expected = data.employees.filter(
      (e) => e.hireDate >= range.from && e.hireDate <= range.to,
    ).length;
    expect(asScalar(run(ir("hire_count", { dateRange: range }), ORG_WIDE)).value).toBe(expected);
    expect(expected).toBe(10);
  });

  it("avg_time_to_fill = mean days postedDate→filledDate over filled reqs, 1dp", () => {
    const filled = data.jobs.filter((j) => j.status === "filled" && j.filledDate !== null);
    const mean =
      filled.reduce((s, j) => s + days(j.postedDate, j.filledDate as string), 0) / filled.length;
    const res = asScalar(run(ir("avg_time_to_fill"), ORG_WIDE));
    expect(res.value).toBe(Math.round(mean * 10) / 10);
    expect(res.unit).toBe("days");
  });

  it("headcount_by_band = active headcount by band, ordered by seniority", () => {
    const bandsInOrder = [...data.bands].sort((a, b) => a.order - b.order).map((b) => b.name);
    const expected = bandsInOrder.map((name) => ({
      key: name,
      value: data.employees.filter((e) => e.active && bnd(e.bandId) === name).length,
    }));
    expect(asGrouped(run(ir("headcount_by_band"), ORG_WIDE)).groups).toEqual(expected);
  });

  it("headcount + groupBy:band is normalized to the headcount_by_band answer", () => {
    expect(run(ir("headcount", {}, "band"), ORG_WIDE)).toEqual(
      run(ir("headcount_by_band"), ORG_WIDE),
    );
    expect(asGrouped(run(ir("headcount", {}, "band"), ORG_WIDE)).metric).toBe("headcount_by_band");
  });
});

describe("job-family scoping is enforced in the executor", () => {
  it("a scoped caller is confined to their family; scope is reported", () => {
    const res = asScalar(run(ir("headcount"), scopedTo(["Engineering"])));
    expect(res.value).toBe(
      data.employees.filter((e) => e.active && fam(e.jobFamilyId) === "Engineering").length,
    );
    expect(res.scope).toEqual({ jobFamilies: ["Engineering"] });
    expect(res.appliedFilters).toEqual({});
  });

  it("a scoped caller asking about a PEER's family is silently confined to their own", () => {
    const res = asScalar(run(ir("headcount", { jobFamily: "Engineering" }), scopedTo(["Sales"])));
    expect(res.value).toBe(
      data.employees.filter((e) => e.active && fam(e.jobFamilyId) === "Sales").length,
    );
    expect(res.scope).toEqual({ jobFamilies: ["Sales"] });
    expect(res.appliedFilters.jobFamily).toBeUndefined();
  });

  it("a scoped caller asking WITHIN scope keeps that family filter", () => {
    const res = asScalar(run(ir("headcount", { jobFamily: "Sales" }), scopedTo(["Sales"])));
    expect(res.appliedFilters).toEqual({ jobFamily: "Sales" });
  });

  it("multi-family scope sums across the assigned families", () => {
    const res = asScalar(run(ir("headcount"), scopedTo(["Engineering", "Product"])));
    const expected = data.employees.filter(
      (e) => e.active && ["Engineering", "Product"].includes(fam(e.jobFamilyId)),
    ).length;
    expect(res.value).toBe(expected);
    expect(res.scope).toEqual({ jobFamilies: ["Engineering", "Product"] });
  });

  it("two single-family recruiters are denied each other's data (disjoint citations)", () => {
    const eng = asScalar(run(ir("open_reqs"), scopedTo(["Engineering"])));
    const sales = asScalar(run(ir("open_reqs"), scopedTo(["Sales"])));
    expect(eng.citations.recordIds.filter((id) => sales.citations.recordIds.includes(id))).toEqual(
      [],
    );
  });

  it("groupBy jobFamily collapses to a scoped caller's families", () => {
    expect(
      asGrouped(run(ir("open_reqs", {}, "jobFamily"), scopedTo(["Engineering"]))).groups.map(
        (g) => g.key,
      ),
    ).toEqual(["Engineering"]);
    expect(
      asGrouped(run(ir("open_reqs", {}, "jobFamily"), ORG_WIDE))
        .groups.map((g) => g.key)
        .sort(),
    ).toEqual(["Design", "Engineering", "Marketing", "Product", "Sales"].sort());
  });
});

describe("groundedness — distinct failures instead of a fabricated number", () => {
  it("no_matching_records for a well-formed query over zero rows", () => {
    const res = run(
      ir("hire_count", {
        jobFamily: "Design",
        dateRange: { from: "2024-01-01", to: "2024-03-31" },
      }),
      ORG_WIDE,
    );
    expect(res).toMatchObject({ ok: false, reason: "no_matching_records", scope: "org_wide" });
  });

  it("no_matching_records for an average over zero filled reqs", () => {
    expect(
      run(
        ir("avg_time_to_fill", { dateRange: { from: "2019-01-01", to: "2019-02-01" } }),
        ORG_WIDE,
      ),
    ).toMatchObject({ ok: false, reason: "no_matching_records" });
  });

  it("unsupported_filter_for_metric: dateRange on a point-in-time metric", () => {
    for (const metric of ["headcount", "open_reqs", "headcount_by_band"] as const) {
      expect(
        run(ir(metric, { dateRange: { from: "2024-01-01", to: "2024-12-31" } }), ORG_WIDE),
        metric,
      ).toMatchObject({ ok: false, reason: "unsupported_filter_for_metric" });
    }
  });

  it("unsupported_filter_for_metric: groupBy on avg_time_to_fill / groupBy:jobFamily on headcount_by_band", () => {
    expect(run(ir("avg_time_to_fill", {}, "band"), ORG_WIDE)).toMatchObject({
      ok: false,
      reason: "unsupported_filter_for_metric",
    });
    expect(run(ir("headcount_by_band", {}, "jobFamily"), ORG_WIDE)).toMatchObject({
      ok: false,
      reason: "unsupported_filter_for_metric",
    });
  });

  it("failures still carry the scope and applied filters", () => {
    const res = run(
      ir("headcount", { dateRange: { from: "2024-01-01", to: "2024-12-31" } }),
      scopedTo(["Engineering"]),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.scope).toEqual({ jobFamilies: ["Engineering"] });
  });
});

describe("citations", () => {
  it("list the exact matched record ids and the fields read", () => {
    const res = asScalar(run(ir("open_reqs", { jobFamily: "Engineering" }), ORG_WIDE));
    const expectedIds = data.jobs
      .filter((j) => j.status === "open" && fam(j.jobFamilyId) === "Engineering")
      .map((j) => j.id);
    expect([...res.citations.recordIds].sort()).toEqual([...expectedIds].sort());
    expect(res.citations.fields).toEqual(expect.arrayContaining(["status", "jobFamilyId"]));
  });
});

describe("executeOverview — the multi-metric path", () => {
  const overview = (filters: QueryIR["filters"] = {}, ctx: ExecutionContext = ORG_WIDE) =>
    executeOverview({ version: 1, overview: true, filters }, ctx, data);

  it("composes one section per metric that has data, each grounded", () => {
    const res = overview();
    if (!res.ok) throw new Error(`expected an overview, got ${JSON.stringify(res)}`);
    expect(res.kind).toBe("overview");
    expect(res.sections.length).toBeGreaterThanOrEqual(4);
    expect(res.sections.map((s) => s.metric)).toEqual(
      expect.arrayContaining(["headcount", "headcount_by_band", "open_reqs"]),
    );
    for (const s of res.sections) {
      expect(s.citations.recordIds.length).toBeGreaterThan(0);
      expect(s.citations.fields.length).toBeGreaterThan(0);
    }
  });

  it("headcount section equals the standalone headcount query", () => {
    const res = overview();
    if (!res.ok) throw new Error("expected an overview");
    const section = res.sections.find((s) => s.metric === "headcount");
    expect(section?.kind === "scalar" && section.value).toBe(
      asScalar(run(ir("headcount"), ORG_WIDE)).value,
    );
  });

  it("a date range scopes the flow metrics but not the point-in-time ones", () => {
    const range = { from: "2024-01-01", to: "2024-12-31" };
    const res = overview({ dateRange: range });
    if (!res.ok) throw new Error("expected an overview");
    const headcount = res.sections.find((s) => s.metric === "headcount");
    const hires = res.sections.find((s) => s.metric === "hire_count");
    expect(headcount?.kind === "scalar" && headcount.value).toBe(
      asScalar(run(ir("headcount"), ORG_WIDE)).value,
    );
    expect(hires?.kind === "scalar" && hires.value).toBe(
      asScalar(run(ir("hire_count", { dateRange: range }), ORG_WIDE)).value,
    );
  });

  it("a recruiter's overview is confined to their job family — every section", () => {
    const res = overview({}, scopedTo(["Engineering"]));
    if (!res.ok) throw new Error("expected an overview");
    expect(res.scope).toEqual({ jobFamilies: ["Engineering"] });
    for (const s of res.sections) {
      expect(s.scope).toEqual({ jobFamilies: ["Engineering"] });
    }
    expect(res.sections.find((s) => s.metric === "open_reqs")?.kind).toBe("scalar");
  });

  it("a recruiter asking outside their scope is silently narrowed, not widened", () => {
    const res = overview({ jobFamily: "Sales" }, scopedTo(["Engineering"]));
    if (!res.ok) throw new Error("expected an overview");
    expect(res.scope).toEqual({ jobFamilies: ["Engineering"] });
    const headcount = res.sections.find((s) => s.metric === "headcount");
    expect(headcount?.kind === "scalar" && headcount.value).toBe(
      asScalar(run(ir("headcount", { jobFamily: "Engineering" }), ORG_WIDE)).value,
    );
  });

  it("citations are the deduped union of every section's records", () => {
    const res = overview();
    if (!res.ok) throw new Error("expected an overview");
    const union = new Set(res.sections.flatMap((s) => s.citations.recordIds));
    expect(new Set(res.citations.recordIds)).toEqual(union);
    expect(res.citations.recordIds.length).toBe(union.size);
  });
});
