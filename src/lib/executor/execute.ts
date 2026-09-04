import {
  JOB_FAMILIES,
  type Band as BandName,
  type DateRange,
  type Filters,
  type GroupByField,
  type JobFamily as FamilyName,
  type Metric,
  type OverviewIR,
  type QueryIR,
} from "@/lib/query-ir";
import type { OrgHiringData } from "@/lib/hiring-data";
import type { ExecutionContext } from "./context";
import { resolveScope, type OrgScope } from "./scope";

/**
 * The deterministic query executor. Plain TypeScript, no AI. Given a validated
 * IR, a resolved {@link ExecutionContext}, and one org's hiring data, it:
 *   1. applies job-family scoping (first, always),
 *   2. rejects filters a metric can't honor,
 *   3. computes the answer and cites the exact records and fields it used,
 *   4. returns a distinct failure for "well-formed but zero matching rows".
 */

export type Unit = "count" | "days";

export type Citations = {
  recordIds: string[];
  fields: string[];
};

export type ScalarAnswer = {
  ok: true;
  kind: "scalar";
  metric: Metric;
  value: number;
  unit: Unit;
  appliedFilters: Filters;
  scope: OrgScope;
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
  scope: OrgScope;
  citations: Citations;
};

export type ExecutorFailureReason = "no_matching_records" | "unsupported_filter_for_metric";

export type ExecutorFailure = {
  ok: false;
  reason: ExecutorFailureReason;
  message: string;
  appliedFilters: Filters;
  scope: OrgScope;
};

export type ExecutorResult = ScalarAnswer | GroupedAnswer | ExecutorFailure;

export type OverviewAnswer = {
  ok: true;
  kind: "overview";
  appliedFilters: Filters;
  scope: OrgScope;
  /** One entry per metric that had matching records, in a fixed reading order. */
  sections: Array<ScalarAnswer | GroupedAnswer>;
  /** Union of every section's cited records and read fields. */
  citations: Citations;
};

// --- Metric capability matrix (documented in PROCESS.md) -------------------

type BaseMetric = "hire_count" | "open_reqs" | "headcount" | "avg_time_to_fill";
type CountMetric = Exclude<BaseMetric, "avg_time_to_fill">;

const ACCEPTS_DATE_RANGE: Record<BaseMetric, boolean> = {
  hire_count: true,
  avg_time_to_fill: true,
  open_reqs: false,
  headcount: false,
};

const BASE_FIELDS: Record<BaseMetric, readonly string[]> = {
  hire_count: ["hireDate"],
  open_reqs: ["status"],
  headcount: ["active"],
  avg_time_to_fill: ["status", "postedDate", "filledDate"],
};

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

function reportMetric(ir: QueryIR, base: BaseMetric, groupBy: GroupByField | undefined): Metric {
  if (base === "headcount" && groupBy === "band") return "headcount_by_band";
  return ir.metric;
}

function fieldsFor(base: BaseMetric, filters: Filters, groupBy?: GroupByField): string[] {
  const set = new Set<string>(BASE_FIELDS[base]);
  if (filters.jobFamily) set.add("jobFamilyId");
  if (filters.band) set.add("bandId");
  if (groupBy === "band") set.add("bandId");
  if (groupBy === "jobFamily") set.add("jobFamilyId");
  return [...set];
}

// --- Executor ---------------------------------------------------------

export function execute(
  queryIR: QueryIR,
  context: ExecutionContext,
  data: OrgHiringData,
): ExecutorResult {
  const familyNameById = new Map(data.jobFamilies.map((f) => [f.id, f.name] as const));
  const bandNameById = new Map(data.bands.map((b) => [b.id, b.name] as const));
  const bandsBySeniority = [...data.bands].sort((a, b) => a.order - b.order).map((b) => b.name);

  const familyNameOf = (id: string): FamilyName => {
    const name = familyNameById.get(id);
    if (!name) throw new Error(`dangling jobFamilyId "${id}"`);
    return name;
  };
  const bandNameOf = (id: string): BandName => {
    const name = bandNameById.get(id);
    if (!name) throw new Error(`dangling bandId "${id}"`);
    return name;
  };

  const { allowedFamilies, effectiveJobFamily, orgScope } = resolveScope(
    context,
    queryIR.filters.jobFamily,
  );
  const allowSet = allowedFamilies ? new Set<FamilyName>(allowedFamilies) : null;

  const appliedFilters: Filters = {
    ...(effectiveJobFamily ? { jobFamily: effectiveJobFamily } : {}),
    ...(queryIR.filters.band ? { band: queryIR.filters.band } : {}),
    ...(queryIR.filters.dateRange ? { dateRange: queryIR.filters.dateRange } : {}),
  };

  const fail = (reason: ExecutorFailureReason, message: string): ExecutorFailure => ({
    ok: false,
    reason,
    message,
    appliedFilters,
    scope: orgScope,
  });

  const plan = planQuery(queryIR);
  if ("unsupported" in plan) {
    return fail("unsupported_filter_for_metric", plan.unsupported);
  }
  if (queryIR.filters.dateRange && !ACCEPTS_DATE_RANGE[plan.base]) {
    return fail(
      "unsupported_filter_for_metric",
      `The "${queryIR.metric}" metric is a point-in-time snapshot and does not accept a date range.`,
    );
  }

  const metric = reportMetric(queryIR, plan.base, plan.groupBy);
  const dateRange = queryIR.filters.dateRange;

  // --- row filtering ---------------------------------------------------
  const familyPasses = (jobFamilyId: string, groupFamily?: FamilyName): boolean => {
    const name = familyNameOf(jobFamilyId);
    if (allowSet && !allowSet.has(name)) return false;
    if (effectiveJobFamily && name !== effectiveJobFamily) return false;
    if (groupFamily && name !== groupFamily) return false;
    return true;
  };
  const bandPasses = (bandId: string, groupBand?: BandName): boolean => {
    const want = groupBand ?? queryIR.filters.band;
    return !want || bandNameOf(bandId) === want;
  };

  type BaseFilter = { family?: FamilyName; band?: BandName };

  function computeBase(
    base: BaseMetric,
    f: BaseFilter,
  ): {
    value: number;
    ids: string[];
    unit: Unit;
    hadRows: boolean;
  } {
    switch (base) {
      case "hire_count": {
        const rows = data.employees.filter(
          (e) =>
            familyPasses(e.jobFamilyId, f.family) &&
            bandPasses(e.bandId, f.band) &&
            withinRange(e.hireDate, dateRange),
        );
        return {
          value: rows.length,
          ids: rows.map((r) => r.id),
          unit: "count",
          hadRows: rows.length > 0,
        };
      }
      case "open_reqs": {
        const rows = data.jobs.filter(
          (j) =>
            j.status === "open" &&
            familyPasses(j.jobFamilyId, f.family) &&
            bandPasses(j.bandId, f.band),
        );
        return {
          value: rows.length,
          ids: rows.map((r) => r.id),
          unit: "count",
          hadRows: rows.length > 0,
        };
      }
      case "headcount": {
        const rows = data.employees.filter(
          (e) => e.active && familyPasses(e.jobFamilyId, f.family) && bandPasses(e.bandId, f.band),
        );
        return {
          value: rows.length,
          ids: rows.map((r) => r.id),
          unit: "count",
          hadRows: rows.length > 0,
        };
      }
      case "avg_time_to_fill": {
        const rows = data.jobs.filter(
          (j) =>
            j.status === "filled" &&
            j.filledDate !== null &&
            familyPasses(j.jobFamilyId, f.family) &&
            bandPasses(j.bandId, f.band) &&
            withinRange(j.filledDate, dateRange),
        );
        if (rows.length === 0) return { value: 0, ids: [], unit: "days", hadRows: false };
        const total = rows.reduce(
          (sum, j) => sum + daysBetween(j.postedDate, j.filledDate as string),
          0,
        );
        return {
          value: round1(total / rows.length),
          ids: rows.map((r) => r.id),
          unit: "days",
          hadRows: true,
        };
      }
      default: {
        const exhaustive: never = base;
        throw new Error(`unhandled metric: ${String(exhaustive)}`);
      }
    }
  }

  const citationFields = fieldsFor(plan.base, appliedFilters, plan.groupBy);

  // --- scalar --------------------------------------------------------
  if (!plan.groupBy) {
    const { value, ids, unit, hadRows } = computeBase(plan.base, {});
    if (!hadRows) {
      return fail(
        "no_matching_records",
        plan.base === "avg_time_to_fill"
          ? "No filled requisitions match this query, so there is no time-to-fill to average."
          : "No records match this query.",
      );
    }
    return {
      ok: true,
      kind: "scalar",
      metric,
      value,
      unit,
      appliedFilters,
      scope: orgScope,
      citations: { recordIds: ids, fields: citationFields },
    };
  }

  // --- grouped (count metrics only) -------------------------------
  const base = plan.base as CountMetric;
  const groups: GroupBucket[] = [];
  const recordIds: string[] = [];

  if (plan.groupBy === "band") {
    const keys: BandName[] = queryIR.filters.band ? [queryIR.filters.band] : bandsBySeniority;
    for (const key of keys) {
      const r = computeBase(base, { band: key });
      groups.push({ key, value: r.value });
      recordIds.push(...r.ids);
    }
  } else {
    const keys: FamilyName[] = effectiveJobFamily
      ? [effectiveJobFamily]
      : (allowedFamilies ?? [...JOB_FAMILIES]);
    for (const key of keys) {
      const r = computeBase(base, { family: key });
      groups.push({ key, value: r.value });
      recordIds.push(...r.ids);
    }
  }

  if (groups.reduce((sum, g) => sum + g.value, 0) === 0) {
    return fail("no_matching_records", "No records match this query.");
  }

  return {
    ok: true,
    kind: "grouped",
    metric,
    groupBy: plan.groupBy,
    groups,
    unit: "count",
    appliedFilters,
    scope: orgScope,
    citations: { recordIds: [...new Set(recordIds)], fields: citationFields },
  };
}

/**
 * The broad-question path: one call, every applicable metric, composed. It
 * dispatches to {@link execute} once per metric, so role scoping (the
 * `resolveScope` boundary) and every filter rule are enforced exactly as they
 * are for a single query — a recruiter's overview can only ever cover their own
 * job family.
 *
 * Point-in-time metrics (headcount, open reqs, headcount by band) drop any date
 * range; the flow metrics (hire count, average time to fill) keep it. A metric
 * with zero matching records is left out; an entirely empty result is a
 * `no_matching_records` failure.
 */
export function executeOverview(
  overviewIR: OverviewIR,
  context: ExecutionContext,
  data: OrgHiringData,
): OverviewAnswer | ExecutorFailure {
  const { jobFamily, band, dateRange } = overviewIR.filters;
  const snapshot: Filters = {
    ...(jobFamily ? { jobFamily } : {}),
    ...(band ? { band } : {}),
  };
  const withDates: Filters = { ...snapshot, ...(dateRange ? { dateRange } : {}) };

  const { allowedFamilies, effectiveJobFamily, orgScope } = resolveScope(context, jobFamily);
  // A breakdown by family is only useful when more than one family is in play.
  const singleFamily = effectiveJobFamily !== undefined || allowedFamilies?.length === 1;

  const specs: QueryIR[] = [
    { version: 1, metric: "headcount", filters: snapshot },
    { version: 1, metric: "headcount_by_band", filters: snapshot },
    singleFamily
      ? { version: 1, metric: "open_reqs", filters: snapshot }
      : { version: 1, metric: "open_reqs", filters: snapshot, groupBy: "jobFamily" },
    { version: 1, metric: "hire_count", filters: withDates },
    { version: 1, metric: "avg_time_to_fill", filters: withDates },
  ];

  const sections: Array<ScalarAnswer | GroupedAnswer> = [];
  for (const spec of specs) {
    const result = execute(spec, context, data);
    if (result.ok) sections.push(result);
  }

  const appliedFilters: Filters = {
    ...(effectiveJobFamily ? { jobFamily: effectiveJobFamily } : {}),
    ...(band ? { band } : {}),
    ...(dateRange ? { dateRange } : {}),
  };

  if (sections.length === 0) {
    return {
      ok: false,
      reason: "no_matching_records",
      message: "No records match this query.",
      appliedFilters,
      scope: orgScope,
    };
  }

  return {
    ok: true,
    kind: "overview",
    appliedFilters,
    scope: orgScope,
    sections,
    citations: {
      recordIds: [...new Set(sections.flatMap((s) => s.citations.recordIds))],
      fields: [...new Set(sections.flatMap((s) => s.citations.fields))],
    },
  };
}
