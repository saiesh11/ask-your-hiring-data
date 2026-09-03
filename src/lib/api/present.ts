import type { GroupedAnswer, ScalarAnswer } from "@/lib/executor";
import type { Filters, Metric } from "@/lib/query-ir";
import type { AnsweredResponse, ChartPayload, Citations, OrgScope } from "./schema";

/**
 * Turns a deterministic executor answer into the grounded, chart-ready response
 * the UI and eval runner consume. Presentation only — no computation.
 */

const METRIC_LABELS: Record<Metric, string> = {
  hire_count: "Hires",
  open_reqs: "Open requisitions",
  headcount: "Headcount",
  avg_time_to_fill: "Average time to fill",
  headcount_by_band: "Headcount by band",
};

function contextSuffix(filters: Filters, scope: OrgScope): string {
  const parts: string[] = [];
  if (filters.jobFamily) {
    parts.push(filters.jobFamily);
  } else if (scope !== "org_wide") {
    parts.push(scope.jobFamilies.join(" / "));
  }
  if (filters.band) parts.push(`${filters.band} band`);
  if (filters.dateRange) parts.push(`${filters.dateRange.from} to ${filters.dateRange.to}`);
  return parts.length > 0 ? ` — ${parts.join(", ")}` : "";
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function valuePhrase(unit: "count" | "days", value: number): string {
  return unit === "days" ? plural(value, "day") : String(value);
}

export function toAnsweredResponse(answer: ScalarAnswer | GroupedAnswer): AnsweredResponse {
  const label = `${METRIC_LABELS[answer.metric]}${contextSuffix(answer.appliedFilters, answer.scope)}`;
  const citations: Citations = {
    recordIds: answer.citations.recordIds,
    fields: answer.citations.fields,
    recordCount: answer.citations.recordIds.length,
  };
  const grounded = `grounded in ${plural(citations.recordCount, "record")}`;

  if (answer.kind === "scalar") {
    const chart: ChartPayload = { kind: "single", unit: answer.unit, label, value: answer.value };
    return {
      status: "answered",
      metric: answer.metric,
      kind: "scalar",
      value: answer.value,
      unit: answer.unit,
      appliedFilters: answer.appliedFilters,
      scope: answer.scope,
      citations,
      chart,
      summary: `${label}: ${valuePhrase(answer.unit, answer.value)} (${grounded}).`,
    };
  }

  const chart: ChartPayload = {
    kind: "bar",
    unit: answer.unit,
    series: answer.groups.map((group) => ({ label: group.key, value: group.value })),
  };
  return {
    status: "answered",
    metric: answer.metric,
    kind: "grouped",
    groups: answer.groups,
    unit: answer.unit,
    appliedFilters: answer.appliedFilters,
    scope: answer.scope,
    citations,
    chart,
    summary: `${label}: ${answer.groups.map((g) => `${g.key} ${g.value}`).join(", ")} (${grounded}).`,
  };
}
