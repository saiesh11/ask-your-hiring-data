import { dataset, getJobFamilyById } from "@/lib/data";
import type { Employee, Job } from "@/lib/data";
import {
  JOB_FAMILIES,
  type Band as BandName,
  type DateRange,
  type Filters,
  type GroupByField,
  type JobFamily as FamilyName,
  type Metric,
  type QueryIR,
} from "@/lib/query-ir";
import { scopeFilters } from "./scope";
import type { Session } from "./session";

/**
 * The deterministic query executor. Plain TypeScript, no AI. This is the ONLY
 * code path that reads the dataset. It:
 *   1. applies server-side role scoping (first, always),
 *   2. rejects filters a metric can't honor,
 *   3. computes the answer and cites the exact records and fields it used,
 *   4. returns a distinct failure for "well-formed but zero matching rows".
 */

export type Unit = "count" | "days";

export type Citations = {
  /** ids of every record that fed the computation */
  recordIds: string[];
  /** record fields the metric + filters actually read */
  fields: string[];
};

export type ScalarAnswer = {
  ok: true;
  kind: "scalar";
  metric: Metric;
  value: number;
  unit: Unit;
  appliedFilters: Filters;
  citations: Citations;
};

export type GroupBucket = { key: string; value: number };

export type GroupedAnswer = {
  ok: true;
  kind: "grouped";
  metric: Metric;
  groupBy: GroupByField;
  groups: GroupBucket[];
  unit: Unit;
  appliedFilters: Filters;
  citations: Citations;
};

export type ExecutorFailureReason = "no_matching_records" | "unsupported_filter_for_metric";

export type ExecutorFailure = {
  ok: false;
  reason: ExecutorFailureReason;
  message: string;
  appliedFilters: Filters;
};

export type ExecutorResult = ScalarAnswer | GroupedAnswer | ExecutorFailure;

// --- Metric capability matrix (documented in PROCESS.md) -------------------
// Stock metrics are point-in-time snapshots and reject a dateRange; flow
// metrics accept one. Grouped averages are deferred to v2.

type BaseMetric = "hire_count" | "open_reqs" | "headcount" | "avg_time_to_fill";
type CountMetric = Exclude<BaseMetric, "avg_time_to_fill">;

const ACCEPTS_DATE_RANGE: Record<BaseMetric, boolean> = {
  hire_count: true, // filters on hireDate
  avg_time_to_fill: true, // filters on filledDate
  open_reqs: false,
  headcount: false,
};

const BASE_FIELDS: Record<BaseMetric, readonly string[]> = {
  hire_count: ["hireDate"],
  open_reqs: ["status"],
  headcount: ["active"],
  avg_time_to_fill: ["status", "postedDate", "filledDate"],
};

// --- Small deterministic helpers -----------------------------------------

const DAY_MS = 86_400_000;

function daysBetween(fromISO: string, toISO: string): number {
  return (Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / DAY_MS;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function withinRange(dateISO: string, range: DateRange | undefined): boolean {
  return !range || (dateISO >= range.from && dateISO <= range.to);
}

function familyNameOf(jobFamilyId: string): string {
  const family = getJobFamilyById(jobFamilyId);
  if (!family) {
    // Unreachable: referential integrity is validated at fixture load.
    throw new Error(`dangling jobFamilyId "${jobFamilyId}"`);
  }
  return family.name;
}

function bandNameOf(bandId: string): string {
  const band = dataset.bands.find((b) => b.id === bandId);
  if (!band) {
    throw new Error(`dangling bandId "${bandId}"`);
  }
  return band.name;
}

function bandsBySeniority(): BandName[] {
  return [...dataset.bands].sort((a, b) => a.order - b.order).map((b) => b.name);
}

function matchesFamilyAndBand(
  row: { jobFamilyId: string; bandId: string },
  filters: Filters,
): boolean {
  if (filters.jobFamily && familyNameOf(row.jobFamilyId) !== filters.jobFamily) return false;
  if (filters.band && bandNameOf(row.bandId) !== filters.band) return false;
  return true;
}

function employeesMatching(filters: Filters): Employee[] {
  return dataset.employees.filter((e) => matchesFamilyAndBand(e, filters));
}

function jobsMatching(filters: Filters): Job[] {
  return dataset.jobs.filter((j) => matchesFamilyAndBand(j, filters));
}

function fieldsFor(base: BaseMetric, filters: Filters, groupBy?: GroupByField): string[] {
  const set = new Set<string>(BASE_FIELDS[base]);
  if (filters.jobFamily) set.add("jobFamilyId");
  if (filters.band) set.add("bandId");
  if (groupBy === "band") set.add("bandId");
  if (groupBy === "jobFamily") set.add("jobFamilyId");
  return [...set];
}

// --- Query planning ------------------------------------------------------

type QueryPlan = { base: BaseMetric; groupBy?: GroupByField } | { unsupported: string };

function planQuery(ir: QueryIR): QueryPlan {
  if (ir.metric === "headcount_by_band") {
    if (ir.groupBy && ir.groupBy !== "band") {
      return {
        unsupported: `"headcount_by_band" is already grouped by band; an explicit groupBy of "${ir.groupBy}" is not allowed.`,
      };
    }
    return { base: "headcount", groupBy: "band" };
  }
  if (ir.metric === "avg_time_to_fill" && ir.groupBy) {
    return {
      unsupported: `"avg_time_to_fill" does not support grouping (grouped averages are a v2 item).`,
    };
  }
  return { base: ir.metric, groupBy: ir.groupBy };
}

/** Reported metric name — collapses headcount + groupBy:band onto headcount_by_band. */
function reportMetric(ir: QueryIR, base: BaseMetric, groupBy: GroupByField | undefined): Metric {
  if (base === "headcount" && groupBy === "band") return "headcount_by_band";
  return ir.metric;
}

// --- Base computation ---------------------------------------------------

/** Rows + numeric value for one base metric under a fully-resolved filter set. */
function computeBase(
  base: BaseMetric,
  filters: Filters,
): { value: number; ids: string[]; unit: Unit; hadRows: boolean } {
  switch (base) {
    case "hire_count": {
      const rows = employeesMatching(filters).filter((e) =>
        withinRange(e.hireDate, filters.dateRange),
      );
      return { value: rows.length, ids: ids(rows), unit: "count", hadRows: rows.length > 0 };
    }
    case "open_reqs": {
      const rows = jobsMatching(filters).filter((j) => j.status === "open");
      return { value: rows.length, ids: ids(rows), unit: "count", hadRows: rows.length > 0 };
    }
    case "headcount": {
      const rows = employeesMatching(filters).filter((e) => e.active);
      return { value: rows.length, ids: ids(rows), unit: "count", hadRows: rows.length > 0 };
    }
    case "avg_time_to_fill": {
      const rows = jobsMatching(filters).filter(
        (j) =>
          j.status === "filled" &&
          j.filledDate !== null &&
          withinRange(j.filledDate, filters.dateRange),
      );
      if (rows.length === 0) {
        return { value: 0, ids: [], unit: "days", hadRows: false };
      }
      const total = rows.reduce(
        (sum, j) => sum + daysBetween(j.postedDate, j.filledDate as string),
        0,
      );
      return { value: round1(total / rows.length), ids: ids(rows), unit: "days", hadRows: true };
    }
    default: {
      const exhaustive: never = base;
      throw new Error(`unhandled metric: ${String(exhaustive)}`);
    }
  }
}

function ids(rows: ReadonlyArray<{ id: string }>): string[] {
  return rows.map((r) => r.id);
}

// --- Scalar / grouped assembly ---------------------------------------

function computeScalar(
  base: BaseMetric,
  filters: Filters,
  metric: Metric,
): ScalarAnswer | ExecutorFailure {
  const { value, ids: recordIds, unit, hadRows } = computeBase(base, filters);
  if (!hadRows) {
    return {
      ok: false,
      reason: "no_matching_records",
      message:
        base === "avg_time_to_fill"
          ? "No filled requisitions match this query, so there is no time-to-fill to average."
          : "No records match this query.",
      appliedFilters: filters,
    };
  }
  return {
    ok: true,
    kind: "scalar",
    metric,
    value,
    unit,
    appliedFilters: filters,
    citations: { recordIds, fields: fieldsFor(base, filters) },
  };
}

function computeGrouped(
  base: CountMetric,
  groupBy: GroupByField,
  filters: Filters,
  metric: Metric,
): GroupedAnswer | ExecutorFailure {
  const groups: GroupBucket[] = [];
  const recordIds: string[] = [];

  if (groupBy === "band") {
    const keys: BandName[] = filters.band ? [filters.band] : bandsBySeniority();
    for (const key of keys) {
      const result = computeBase(base, { ...filters, band: key });
      groups.push({ key, value: result.value });
      recordIds.push(...result.ids);
    }
  } else {
    const keys: FamilyName[] = filters.jobFamily ? [filters.jobFamily] : [...JOB_FAMILIES];
    for (const key of keys) {
      const result = computeBase(base, { ...filters, jobFamily: key });
      groups.push({ key, value: result.value });
      recordIds.push(...result.ids);
    }
  }

  const total = groups.reduce((sum, g) => sum + g.value, 0);
  if (total === 0) {
    return {
      ok: false,
      reason: "no_matching_records",
      message: "No records match this query.",
      appliedFilters: filters,
    };
  }

  return {
    ok: true,
    kind: "grouped",
    metric,
    groupBy,
    groups,
    unit: "count",
    appliedFilters: filters,
    citations: { recordIds: [...new Set(recordIds)], fields: fieldsFor(base, filters, groupBy) },
  };
}

// --- Public entrypoint ------------------------------------------------

export function execute(queryIR: QueryIR, session: Session): ExecutorResult {
  // 1. Role scoping — first, here, on every query.
  const appliedFilters = scopeFilters(queryIR.filters, session);

  // 2. Plan: normalize headcount_by_band, reject unsupported groupBy combos.
  const plan = planQuery(queryIR);
  if ("unsupported" in plan) {
    return {
      ok: false,
      reason: "unsupported_filter_for_metric",
      message: plan.unsupported,
      appliedFilters,
    };
  }

  // 3. Reject a dateRange on a point-in-time metric.
  if (appliedFilters.dateRange && !ACCEPTS_DATE_RANGE[plan.base]) {
    return {
      ok: false,
      reason: "unsupported_filter_for_metric",
      message: `The "${queryIR.metric}" metric is a point-in-time snapshot and does not accept a date range.`,
      appliedFilters,
    };
  }

  const metric = reportMetric(queryIR, plan.base, plan.groupBy);

  // 4. Compute.
  if (plan.groupBy) {
    if (plan.base === "avg_time_to_fill") {
      // Unreachable: planQuery already rejects avg_time_to_fill + groupBy.
      throw new Error("avg_time_to_fill cannot be grouped");
    }
    return computeGrouped(plan.base, plan.groupBy, appliedFilters, metric);
  }
  return computeScalar(plan.base, appliedFilters, metric);
}
