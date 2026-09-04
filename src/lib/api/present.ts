import type { GroupedAnswer, OverviewAnswer, ScalarAnswer } from "@/lib/executor";
import type { Filters, Metric } from "@/lib/query-ir";
import type {
  AnsweredResponse,
  ChartPayload,
  Citations,
  OverviewResponse,
  OverviewSection,
} from "./schema";

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

function filterSuffix(filters: Filters): string {
  const parts: string[] = [];
  if (filters.jobFamily) parts.push(filters.jobFamily);
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

/** The grounded body of one answer — no `status`, so it serves a section too. */
function presentAnswer(answer: ScalarAnswer | GroupedAnswer): OverviewSection {
  const label = `${METRIC_LABELS[answer.metric]}${filterSuffix(answer.appliedFilters)}`;
  const citations: Citations = {
    recordIds: answer.citations.recordIds,
    fields: answer.citations.fields,
    recordCount: answer.citations.recordIds.length,
  };
  const grounded = `grounded in ${plural(citations.recordCount, "record")}`;

  if (answer.kind === "scalar") {
    const chart: ChartPayload = { kind: "single", unit: answer.unit, label, value: answer.value };
    return {
      metric: answer.metric,
      kind: "scalar",
      value: answer.value,
      unit: answer.unit,
      appliedFilters: answer.appliedFilters,
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
    metric: answer.metric,
    kind: "grouped",
    groups: answer.groups,
    unit: answer.unit,
    appliedFilters: answer.appliedFilters,
    citations,
    chart,
    summary: `${label}: ${answer.groups.map((g) => `${g.key} ${g.value}`).join(", ")} (${grounded}).`,
  };
}

export function toAnsweredResponse(answer: ScalarAnswer | GroupedAnswer): AnsweredResponse {
  return { status: "answered", ...presentAnswer(answer) };
}

export function toOverviewResponse(overview: OverviewAnswer): OverviewResponse {
  const sections = overview.sections.map(presentAnswer);
  const { jobFamily, band, dateRange } = overview.appliedFilters;

  const qualifiers: string[] = [];
  if (band) qualifiers.push(`${band} band`);
  if (dateRange) qualifiers.push(`${dateRange.from} to ${dateRange.to}`);
  const scope =
    (jobFamily ?? "the organization") + (qualifiers.length ? ` (${qualifiers.join(", ")})` : "");

  const headline = sections
    .map((s) =>
      s.kind === "scalar"
        ? `${METRIC_LABELS[s.metric].toLowerCase()} ${valuePhrase(s.unit, s.value ?? 0)}`
        : `${METRIC_LABELS[s.metric].toLowerCase()} across ${s.groups?.length ?? 0} groups`,
    )
    .join(", ");

  return {
    status: "overview",
    appliedFilters: overview.appliedFilters,
    sections,
    citations: {
      recordIds: overview.citations.recordIds,
      fields: overview.citations.fields,
      recordCount: overview.citations.recordIds.length,
    },
    summary: `Hiring overview for ${scope}: ${headline}.`,
  };
}
