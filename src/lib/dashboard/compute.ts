import { resolveScope, type ExecutionContext } from "@/lib/executor";
import type { OrgHiringData } from "@/lib/hiring-data";
import type { JobFamily } from "@/lib/query-ir";
import { DashboardDataSchema, type DashboardData } from "./schema";

const DAY_MS = 86_400_000;
const AGING_THRESHOLD_DAYS = 60;
const TREND_MONTHS = 12;
const AGING_LIMIT = 12;
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const daysBetween = (fromISO: string, toISO: string): number =>
  Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / DAY_MS);

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * The Dashboard view: KPIs, a 12-month hiring trend, headcount composition and
 * by-band, and requisition aging — all derived from `OrgHiringData` and confined
 * to the caller's job-family scope via {@link resolveScope} (the same security
 * boundary the executor uses).
 */
export function computeDashboard(data: OrgHiringData, context: ExecutionContext): DashboardData {
  const { allowedFamilies, orgScope } = resolveScope(context, undefined);
  const allow = allowedFamilies ? new Set<JobFamily>(allowedFamilies) : null;

  const familyNameById = new Map(data.jobFamilies.map((f) => [f.id, f.name] as const));
  const bandNameById = new Map(data.bands.map((b) => [b.id, b.name] as const));
  const bandsBySeniority = [...data.bands].sort((a, b) => a.order - b.order);

  const famName = (id: string): JobFamily => {
    const name = familyNameById.get(id);
    if (!name) throw new Error(`dangling jobFamilyId "${id}"`);
    return name;
  };
  const bandName = (id: string): string => bandNameById.get(id) ?? id;
  const inScope = (jobFamilyId: string): boolean => !allow || allow.has(famName(jobFamilyId));

  const employees = data.employees.filter((e) => inScope(e.jobFamilyId));
  const jobs = data.jobs.filter((j) => inScope(j.jobFamilyId));

  // Synthetic data isn't anchored to "now": treat the latest date it contains
  // as today, so the trend window and req ages land on real rows.
  const dates = [
    ...employees.map((e) => e.hireDate),
    ...jobs.map((j) => j.postedDate),
    ...jobs.flatMap((j) => (j.filledDate ? [j.filledDate] : [])),
  ];
  const asOf = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "2024-12-31";

  const trendStart = new Date(`${asOf}T00:00:00Z`);
  trendStart.setUTCMonth(trendStart.getUTCMonth() - (TREND_MONTHS - 1));
  trendStart.setUTCDate(1);
  const months = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const d = new Date(trendStart);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 7); // YYYY-MM
  });
  const windowStart = months[0] ?? asOf.slice(0, 7);

  const active = employees.filter((e) => e.active);
  const openJobs = jobs.filter((j) => j.status === "open");
  const filled = jobs.filter((j) => j.status === "filled" && j.filledDate);
  const hiresInWindow = employees.filter(
    (e) => e.hireDate >= `${windowStart}-01` && e.hireDate <= asOf,
  );

  // hiring trend
  const perMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const e of hiresInWindow) {
    const k = e.hireDate.slice(0, 7);
    if (perMonth.has(k)) perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
  }
  const hiringTrend = months.map((m) => ({
    label: MON[Number(m.slice(5, 7)) - 1] ?? m,
    value: perMonth.get(m) ?? 0,
  }));

  // composition (active headcount by family)
  const compMap = new Map<string, number>();
  for (const e of active)
    compMap.set(famName(e.jobFamilyId), (compMap.get(famName(e.jobFamilyId)) ?? 0) + 1);
  const composition = [...compMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // headcount by band (junior → senior)
  const headcountByBand = bandsBySeniority.map((b) => ({
    label: b.name,
    value: active.filter((e) => e.bandId === b.id).length,
  }));

  // requisition aging
  const reqAging = openJobs
    .map((j) => {
      const ageDays = Math.max(0, daysBetween(j.postedDate, asOf));
      return {
        id: j.id,
        label: `${famName(j.jobFamilyId)} · ${bandName(j.bandId)}`,
        jobFamily: famName(j.jobFamilyId),
        ageDays,
        overThreshold: ageDays > AGING_THRESHOLD_DAYS,
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, AGING_LIMIT);

  const avgTimeToFill =
    filled.length > 0
      ? round1(
          filled.reduce((s, j) => s + daysBetween(j.postedDate, j.filledDate as string), 0) /
            filled.length,
        )
      : 0;

  return DashboardDataSchema.parse({
    scope: orgScope,
    window: `${windowStart} — ${asOf.slice(0, 7)}`,
    kpis: {
      headcount: { label: "Headcount", value: active.length, unit: "count" },
      openReqs: { label: "Open requisitions", value: openJobs.length, unit: "count" },
      hires: { label: "Hires · 12 mo", value: hiresInWindow.length, unit: "count" },
      avgTimeToFill: { label: "Avg time to fill", value: avgTimeToFill, unit: "days" },
    },
    hiringTrend,
    composition,
    headcountByBand,
    reqAging,
    agingThresholdDays: AGING_THRESHOLD_DAYS,
  });
}
