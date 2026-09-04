"use client";

import { useState } from "react";
import type {
  AnsweredResponse,
  OverviewResponse,
  OverviewSection,
  RefusedResponse,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { MetricChart, type ChartVariant } from "./metric-chart";
import { Num } from "./num";

type AnyResponse = AnsweredResponse | RefusedResponse | OverviewResponse;

const METRIC_LABEL: Record<OverviewSection["metric"], string> = {
  hire_count: "Hires",
  open_reqs: "Open requisitions",
  headcount: "Headcount",
  avg_time_to_fill: "Avg time to fill",
  headcount_by_band: "Headcount by band",
};

/** A plain count reads best as a figure, not a chart. */
const isKpi = (s: OverviewSection) => s.kind === "scalar" && s.metric !== "avg_time_to_fill";

export function AnswerView({ response }: { response: AnyResponse }) {
  if (response.status === "refused") return <RefusalView response={response} />;
  if (response.status === "overview") return <OverviewView response={response} />;
  return <AnsweredView response={response} />;
}

/** One grounded result: summary line, chart, grounding line, records toggle. */
function GroundedAnswer({ answer, variant }: { answer: OverviewSection; variant?: ChartVariant }) {
  const [showRecords, setShowRecords] = useState(false);
  const { citations } = answer;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed font-medium">{answer.summary}</p>
      <MetricChart response={answer} variant={variant} />
      <div className="text-[13px] text-muted-foreground">
        <span data-testid="grounded-line">
          Grounded in {citations.recordCount} record{citations.recordCount === 1 ? "" : "s"}
        </span>
        {citations.fields.length > 0 && <> · fields: {citations.fields.join(", ")}</>}
        {citations.recordIds.length > 0 && (
          <>
            {" · "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setShowRecords((v) => !v)}
            >
              {showRecords ? "hide records" : "show records"}
            </button>
          </>
        )}
      </div>
      {showRecords && (
        <code className="mt-2 block rounded-md bg-muted p-2 text-xs break-all">
          {citations.recordIds.join(", ")}
        </code>
      )}
    </div>
  );
}

function AnsweredView({ response }: { response: AnsweredResponse }) {
  return (
    <div data-testid="answered">
      <GroundedAnswer answer={response} />
    </div>
  );
}

/** Compact figure for the top strip of an overview — no chart, no toggle. */
function KpiTile({ section }: { section: OverviewSection }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
        {METRIC_LABEL[section.metric]}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-primary">
        <Num>{(section.value ?? 0).toLocaleString()}</Num>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {section.citations.recordCount} record{section.citations.recordCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function OverviewView({ response }: { response: OverviewResponse }) {
  const kpis = response.sections.filter(isKpi);
  const charts = response.sections.filter((s) => !isKpi(s));

  return (
    <div data-testid="overview" className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed font-medium">{response.summary}</p>

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((section, i) => (
            <KpiTile key={i} section={section} />
          ))}
        </div>
      )}

      {charts.length > 0 && (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {charts.map((section, i) => (
            <div key={i} className="rounded-lg border bg-card p-3.5">
              <GroundedAnswer answer={section} variant="compact" />
            </div>
          ))}
        </div>
      )}

      <p className="text-[13px] text-muted-foreground">
        Overview grounded in {response.citations.recordCount} record
        {response.citations.recordCount === 1 ? "" : "s"} across {response.sections.length} metrics.
      </p>
    </div>
  );
}

function RefusalView({ response }: { response: RefusedResponse }) {
  return (
    <div data-testid="refused">
      <p className="mb-2">{response.message}</p>
      <Badge variant="outline" className="text-muted-foreground">
        {response.reason.replace(/_/g, " ")} · {response.stage.replace(/_/g, " ")}
      </Badge>
    </div>
  );
}
