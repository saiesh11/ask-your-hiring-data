import { describe, expect, it } from "vitest";
import { ORG_WIDE, scopedTo } from "@/lib/executor";
import { computeDashboard } from "@/lib/dashboard";
import { buildOrgDataset, DEFAULT_SEED, OrgHiringDataSchema } from "@/lib/hiring-data";

const data = OrgHiringDataSchema.parse(buildOrgDataset(DEFAULT_SEED));

describe("computeDashboard", () => {
  it("org-wide: KPIs, a 12-month trend, and self-consistent breakdowns", () => {
    const d = computeDashboard(data, ORG_WIDE);

    expect(d.scope).toBe("org_wide");
    expect(d.kpis.headcount.value).toBeGreaterThan(0);
    expect(d.kpis.avgTimeToFill.unit).toBe("days");
    expect(d.hiringTrend).toHaveLength(12);

    // composition and by-band both partition the active headcount
    expect(d.composition.reduce((s, p) => s + p.value, 0)).toBe(d.kpis.headcount.value);
    expect(d.headcountByBand.reduce((s, p) => s + p.value, 0)).toBe(d.kpis.headcount.value);

    // aging is capped and sorted oldest-first
    expect(d.reqAging.length).toBeLessThanOrEqual(12);
    expect(d.reqAging.length).toBe(Math.min(12, d.kpis.openReqs.value));
    for (let i = 1; i < d.reqAging.length; i++) {
      expect(d.reqAging[i - 1]!.ageDays).toBeGreaterThanOrEqual(d.reqAging[i]!.ageDays);
    }
    for (const r of d.reqAging) {
      expect(r.overThreshold).toBe(r.ageDays > d.agingThresholdDays);
    }
  });

  it("scoped: only the caller's families, and never more than org-wide", () => {
    const eng = computeDashboard(data, scopedTo(["Engineering"]));
    const wide = computeDashboard(data, ORG_WIDE);

    expect(eng.scope).toEqual({ jobFamilies: ["Engineering"] });
    expect(eng.composition.every((p) => p.label === "Engineering")).toBe(true);
    expect(eng.reqAging.every((r) => r.jobFamily === "Engineering")).toBe(true);
    expect(eng.kpis.headcount.value).toBeLessThanOrEqual(wide.kpis.headcount.value);
    expect(eng.kpis.openReqs.value).toBeLessThanOrEqual(wide.kpis.openReqs.value);
  });
});
