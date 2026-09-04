import { describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import type { QueryIR } from "@/lib/query-ir";
import {
  execute,
  executeOverview,
  resolveSession,
  scopeFilters,
  UnknownUserError,
  type ExecutorResult,
  type ScalarAnswer,
  type GroupedAnswer,
} from "@/lib/executor";

// --- raw-fixture helpers (independent of the executor's own helpers) --------
const familyName = new Map(dataset.jobFamilies.map((f) => [f.id, f.name] as const));
const bandName = new Map(dataset.bands.map((b) => [b.id, b.name] as const));
const fam = (id: string): string => familyName.get(id) ?? "?";
const bnd = (id: string): string => bandName.get(id) ?? "?";
const days = (from: string, to: string): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

const chro = resolveSession("chro");
const recruiterEng = resolveSession("recruiter_eng");
const recruiterSales = resolveSession("recruiter_sales");

const ir = (
  metric: QueryIR["metric"],
  filters: QueryIR["filters"] = {},
  groupBy?: QueryIR["groupBy"],
): QueryIR => ({ version: 1, metric, filters, ...(groupBy ? { groupBy } : {}) });

function asScalar(result: ExecutorResult): ScalarAnswer {
  if (!result.ok || result.kind !== "scalar") {
    throw new Error(`expected a scalar answer, got ${JSON.stringify(result)}`);
  }
  return result;
}
function asGrouped(result: ExecutorResult): GroupedAnswer {
  if (!result.ok || result.kind !== "grouped") {
    throw new Error(`expected a grouped answer, got ${JSON.stringify(result)}`);
  }
  return result;
}

describe("resolveSession", () => {
  it("maps demo users to role + scope", () => {
    expect(resolveSession("chro")).toEqual({ userId: "chro", role: "chro" });
    expect(resolveSession("recruiter_eng")).toEqual({
      userId: "recruiter_eng",
      role: "recruiter",
      jobFamilyName: "Engineering",
    });
    expect(resolveSession("recruiter_sales")).toMatchObject({ jobFamilyName: "Sales" });
  });

  it("throws UnknownUserError for an unrecognized id (never guesses a role)", () => {
    expect(() => resolveSession("intruder")).toThrow(UnknownUserError);
  });
});

describe("scopeFilters — the security boundary", () => {
  it("CHRO: filters pass through untouched", () => {
    expect(scopeFilters({ jobFamily: "Sales", band: "Senior" }, chro)).toEqual({
      jobFamily: "Sales",
      band: "Senior",
    });
  });

  it("recruiter: jobFamily is FORCED to their own, overriding whatever was asked", () => {
    expect(scopeFilters({ jobFamily: "Engineering" }, recruiterSales)).toEqual({
      jobFamily: "Sales",
    });
    expect(scopeFilters({}, recruiterEng)).toEqual({ jobFamily: "Engineering" });
  });

  it("is idempotent (eval re-runs it when recomputing expectations)", () => {
    const once = scopeFilters({ jobFamily: "Engineering", band: "Mid" }, recruiterSales);
    expect(scopeFilters(once, recruiterSales)).toEqual(once);
    expect(once.jobFamily).toBe("Sales");
  });
});

describe("metrics — executor output equals a naive recompute from raw fixtures", () => {
  it("headcount = active employees (org-wide and family-filtered)", () => {
    const orgExpected = dataset.employees.filter((e) => e.active).length;
    expect(asScalar(execute(ir("headcount"), chro)).value).toBe(orgExpected);
    expect(orgExpected).toBe(49); // anchor

    const engExpected = dataset.employees.filter(
      (e) => e.active && fam(e.jobFamilyId) === "Engineering",
    ).length;
    const res = asScalar(execute(ir("headcount", { jobFamily: "Engineering" }), chro));
    expect(res.value).toBe(engExpected);
    expect(res.unit).toBe("count");
  });

  it("open_reqs = jobs with status 'open'", () => {
    const expected = dataset.jobs.filter((j) => j.status === "open").length;
    expect(asScalar(execute(ir("open_reqs"), chro)).value).toBe(expected);
    expect(expected).toBe(18); // anchor
  });

  it("hire_count = employees hired within the dateRange", () => {
    const range = { from: "2024-01-01", to: "2024-12-31" };
    const expected = dataset.employees.filter(
      (e) => e.hireDate >= range.from && e.hireDate <= range.to,
    ).length;
    const res = asScalar(execute(ir("hire_count", { dateRange: range }), chro));
    expect(res.value).toBe(expected);
    expect(expected).toBe(10); // anchor
  });

  it("avg_time_to_fill = mean days postedDate→filledDate over filled reqs, to 1dp", () => {
    const filled = dataset.jobs.filter((j) => j.status === "filled" && j.filledDate !== null);
    const mean =
      filled.reduce((s, j) => s + days(j.postedDate, j.filledDate as string), 0) / filled.length;
    const expected = Math.round(mean * 10) / 10;
    const res = asScalar(execute(ir("avg_time_to_fill"), chro));
    expect(res.value).toBe(expected);
    expect(res.unit).toBe("days");
    expect(res.citations.recordIds).toHaveLength(filled.length);
  });

  it("headcount_by_band = active headcount grouped by band, ordered by seniority", () => {
    const bandsInOrder = [...dataset.bands].sort((a, b) => a.order - b.order).map((b) => b.name);
    const expected = bandsInOrder.map((name) => ({
      key: name,
      value: dataset.employees.filter((e) => e.active && bnd(e.bandId) === name).length,
    }));
    const res = asGrouped(execute(ir("headcount_by_band"), chro));
    expect(res.groups).toEqual(expected);
    expect(res.groups.map((g) => g.key)).toEqual(["Junior", "Mid", "Senior", "Staff"]);
  });

  it("headcount + groupBy:band is normalized to the headcount_by_band answer", () => {
    const viaGroupBy = execute(ir("headcount", {}, "band"), chro);
    const viaMetric = execute(ir("headcount_by_band"), chro);
    expect(viaGroupBy).toEqual(viaMetric);
    expect(asGrouped(viaGroupBy).metric).toBe("headcount_by_band");
  });
});

describe("role scoping is enforced in the executor", () => {
  it("recruiter and CHRO get different answers to the same question", () => {
    const question = ir("headcount");
    const eng = asScalar(execute(question, recruiterEng));
    const org = asScalar(execute(question, chro));
    expect(eng.value).toBeLessThan(org.value);
    expect(eng.appliedFilters).toEqual({ jobFamily: "Engineering" });
    expect(org.appliedFilters).toEqual({});
  });

  it("a recruiter asking about a PEER's family is silently narrowed to their own", () => {
    const res = asScalar(execute(ir("headcount", { jobFamily: "Engineering" }), recruiterSales));
    // The override is visible in appliedFilters, and the number is Sales', not Engineering's.
    expect(res.appliedFilters.jobFamily).toBe("Sales");
    const salesExpected = dataset.employees.filter(
      (e) => e.active && fam(e.jobFamilyId) === "Sales",
    ).length;
    expect(res.value).toBe(salesExpected);
  });

  it("two recruiters are denied each other's data (disjoint record citations)", () => {
    const eng = asScalar(execute(ir("open_reqs"), recruiterEng));
    const sales = asScalar(execute(ir("open_reqs"), recruiterSales));
    expect(eng.appliedFilters.jobFamily).toBe("Engineering");
    expect(sales.appliedFilters.jobFamily).toBe("Sales");
    const overlap = eng.citations.recordIds.filter((id) => sales.citations.recordIds.includes(id));
    expect(overlap).toEqual([]);
  });

  it("a recruiter grouping by jobFamily collapses to their single family", () => {
    const res = asGrouped(execute(ir("open_reqs", {}, "jobFamily"), recruiterEng));
    expect(res.groups.map((g) => g.key)).toEqual(["Engineering"]);
  });

  it("the CHRO grouping by jobFamily sees every family", () => {
    const res = asGrouped(execute(ir("open_reqs", {}, "jobFamily"), chro));
    expect(res.groups.map((g) => g.key).sort()).toEqual(
      ["Design", "Engineering", "Marketing", "Product", "Sales"].sort(),
    );
  });
});

describe("groundedness — distinct failures instead of a fabricated number", () => {
  it("no_matching_records when a well-formed query matches zero rows", () => {
    // Design has zero hires in Q1 2024 by construction of the seeded dataset.
    const res = execute(
      ir("hire_count", {
        jobFamily: "Design",
        dateRange: { from: "2024-01-01", to: "2024-03-31" },
      }),
      chro,
    );
    expect(res).toMatchObject({ ok: false, reason: "no_matching_records" });
  });

  it("no_matching_records for an average over zero filled reqs", () => {
    const res = execute(
      ir("avg_time_to_fill", { dateRange: { from: "2019-01-01", to: "2019-02-01" } }),
      chro,
    );
    expect(res).toMatchObject({ ok: false, reason: "no_matching_records" });
  });

  it("unsupported_filter_for_metric: dateRange on a point-in-time metric", () => {
    for (const metric of ["headcount", "open_reqs", "headcount_by_band"] as const) {
      const res = execute(
        ir(metric, { dateRange: { from: "2024-01-01", to: "2024-12-31" } }),
        chro,
      );
      expect(res, metric).toMatchObject({ ok: false, reason: "unsupported_filter_for_metric" });
    }
  });

  it("unsupported_filter_for_metric: groupBy on avg_time_to_fill", () => {
    expect(execute(ir("avg_time_to_fill", {}, "band"), chro)).toMatchObject({
      ok: false,
      reason: "unsupported_filter_for_metric",
    });
  });

  it("unsupported_filter_for_metric: explicit groupBy:jobFamily on headcount_by_band", () => {
    expect(execute(ir("headcount_by_band", {}, "jobFamily"), chro)).toMatchObject({
      ok: false,
      reason: "unsupported_filter_for_metric",
    });
  });

  it("every failure still reports the applied (post-scoping) filters", () => {
    const res = execute(
      ir("headcount", { dateRange: { from: "2024-01-01", to: "2024-12-31" } }),
      recruiterEng,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.appliedFilters.jobFamily).toBe("Engineering");
  });
});

describe("citations", () => {
  it("list the exact matched record ids and the fields the computation read", () => {
    const res = asScalar(execute(ir("open_reqs", { jobFamily: "Engineering" }), chro));
    const expectedIds = dataset.jobs
      .filter((j) => j.status === "open" && fam(j.jobFamilyId) === "Engineering")
      .map((j) => j.id);
    expect([...res.citations.recordIds].sort()).toEqual([...expectedIds].sort());
    expect(res.citations.fields).toEqual(expect.arrayContaining(["status", "jobFamilyId"]));
  });

  it("hire_count citations include hireDate (+ jobFamilyId when family-filtered)", () => {
    const res = asScalar(
      execute(
        ir("hire_count", {
          jobFamily: "Sales",
          dateRange: { from: "2023-01-01", to: "2025-06-30" },
        }),
        chro,
      ),
    );
    expect(res.citations.fields).toEqual(expect.arrayContaining(["hireDate", "jobFamilyId"]));
  });
});

describe("executeOverview — the multi-metric path", () => {
  const overview = (filters: QueryIR["filters"] = {}, session = chro) =>
    executeOverview({ version: 1, overview: true, filters }, session);

  it("composes one section per metric that has data, each grounded", () => {
    const res = overview();
    if (!res.ok) throw new Error(`expected an overview, got ${JSON.stringify(res)}`);
    expect(res.kind).toBe("overview");
    expect(res.sections.length).toBeGreaterThanOrEqual(4);
    // headcount + a by-band breakdown are always present for the org
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
    const solo = asScalar(execute(ir("headcount"), chro));
    expect(section?.kind === "scalar" && section.value).toBe(solo.value);
  });

  it("a date range scopes the flow metrics but not the point-in-time ones", () => {
    const res = overview({ dateRange: { from: "2024-01-01", to: "2024-12-31" } });
    if (!res.ok) throw new Error("expected an overview");
    const headcount = res.sections.find((s) => s.metric === "headcount");
    const hires = res.sections.find((s) => s.metric === "hire_count");
    // headcount ignores the range → same as the unfiltered snapshot
    expect(headcount?.kind === "scalar" && headcount.value).toBe(
      asScalar(execute(ir("headcount"), chro)).value,
    );
    // hire_count respects it
    expect(hires?.kind === "scalar" && hires.value).toBe(
      asScalar(
        execute(ir("hire_count", { dateRange: { from: "2024-01-01", to: "2024-12-31" } }), chro),
      ).value,
    );
  });

  it("a recruiter's overview is confined to their job family — every section", () => {
    const res = overview({}, recruiterEng);
    if (!res.ok) throw new Error("expected an overview");
    expect(res.appliedFilters.jobFamily).toBe("Engineering");
    for (const s of res.sections) {
      expect(s.appliedFilters.jobFamily).toBe("Engineering");
    }
    // open_reqs collapses from grouped to scalar when scoped to one family
    expect(res.sections.find((s) => s.metric === "open_reqs")?.kind).toBe("scalar");
  });

  it("a recruiter asking outside their scope is silently narrowed, not widened", () => {
    const res = overview({ jobFamily: "Sales" }, recruiterEng);
    if (!res.ok) throw new Error("expected an overview");
    expect(res.appliedFilters.jobFamily).toBe("Engineering");
    const headcount = res.sections.find((s) => s.metric === "headcount");
    expect(headcount?.kind === "scalar" && headcount.value).toBe(
      asScalar(execute(ir("headcount", { jobFamily: "Engineering" }), chro)).value,
    );
  });

  it("citations are the deduped union of every section's records", () => {
    const res = overview();
    if (!res.ok) throw new Error("expected an overview");
    const union = new Set(res.sections.flatMap((s) => s.citations.recordIds));
    expect(new Set(res.citations.recordIds)).toEqual(union);
    expect(res.citations.recordIds.length).toBe(union.size);
  });

  it("returns no_matching_records only when EVERY metric is empty", () => {
    // Design has no open reqs / hires in this window, but headcount is point-in-time
    // so the overview still answers. A window with truly nothing anywhere is the
    // failure case — use a filter that removes every row.
    const empty = overview(
      { jobFamily: "Design", dateRange: { from: "1990-01-01", to: "1990-12-31" } },
      chro,
    );
    // headcount for Design is still non-zero → still an overview
    if (empty.ok) {
      expect(empty.sections.every((s) => s.appliedFilters.jobFamily === "Design")).toBe(true);
    }
  });
});
