import { describe, expect, it } from "vitest";
import { METRICS } from "@/lib/query-ir";
import { loadEvalSet, runEvalSuite } from "@/lib/eval-runner";

describe("eval suite — the AI-quality gate", () => {
  const cases = loadEvalSet();

  it("covers the required matrix", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);

    const answeredMetrics = new Set(
      cases.flatMap((c) => (c.expected.refused ? [] : [c.expected.metric])),
    );
    for (const metric of METRICS) {
      expect(answeredMetrics.has(metric), metric).toBe(true);
    }

    const hasGroupBy = cases.some((c) => !c.expected.refused && c.expected.groupBy !== undefined);
    const hasDateRange = cases.some(
      (c) => !c.expected.refused && c.expected.appliedFilters?.dateRange !== undefined,
    );
    const hasScopedContext = cases.some(
      (c) => !c.expected.refused && typeof c.expected.scope === "object",
    );
    expect(hasGroupBy, "at least one groupBy case").toBe(true);
    expect(hasDateRange, "at least one dateRange case").toBe(true);
    expect(hasScopedContext, "at least one job-family-scoped answered case").toBe(true);

    const scopingCases = cases.filter((c) => c.userId.startsWith("recruiter_"));
    expect(scopingCases.length, "at least 3 scoping cases").toBeGreaterThanOrEqual(3);
    expect(
      scopingCases.some((c) => c.id === "scope-recruiter-sales-override" && !c.expected.refused),
      "at least one cross-family override case",
    ).toBe(true);

    expect(
      cases.filter((c) => c.expected.refused).length,
      "at least 2 refusal cases",
    ).toBeGreaterThanOrEqual(2);
  });

  it("every case passes end to end", async () => {
    const summary = await runEvalSuite(cases);
    const failures = summary.results
      .filter((r) => !r.passed)
      .map((r) => `${r.id}: ${r.failures.join("; ")} [observed: ${r.observed}]`);
    expect(failures, `${summary.failed}/${summary.total} eval cases failed`).toEqual([]);
    expect(summary.passed).toBe(summary.total);
  });
});
