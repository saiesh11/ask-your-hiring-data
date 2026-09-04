"use client";

import { useState } from "react";
import type {
  AnsweredResponse,
  OverviewResponse,
  OverviewSection,
  RefusedResponse,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { MetricChart } from "./metric-chart";

type AnyResponse = AnsweredResponse | RefusedResponse | OverviewResponse;

export function AnswerView({ response }: { response: AnyResponse }) {
  if (response.status === "refused") return <RefusalView response={response} />;
  if (response.status === "overview") return <OverviewView response={response} />;
  return <AnsweredView response={response} />;
}

/** One grounded result: summary line, chart, grounding line, records toggle. */
function GroundedAnswer({ answer }: { answer: OverviewSection }) {
  const [showRecords, setShowRecords] = useState(false);
  const { citations } = answer;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed font-medium">{answer.summary}</p>
      <MetricChart response={answer} />
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

function OverviewView({ response }: { response: OverviewResponse }) {
  return (
    <div data-testid="overview" className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed font-medium">{response.summary}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {response.sections.map((section, i) => (
          <div key={i} className="rounded-lg border bg-card p-3.5">
            <GroundedAnswer answer={section} />
          </div>
        ))}
      </div>
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
