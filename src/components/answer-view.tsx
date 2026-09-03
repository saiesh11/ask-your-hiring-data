"use client";

import { useState } from "react";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { MetricChart } from "./metric-chart";

export function AnswerView({ response }: { response: AnsweredResponse | RefusedResponse }) {
  return response.status === "refused" ? (
    <RefusalView response={response} />
  ) : (
    <AnsweredView response={response} />
  );
}

function AnsweredView({ response }: { response: AnsweredResponse }) {
  const [showRecords, setShowRecords] = useState(false);
  const { citations } = response;

  return (
    <div data-testid="answered">
      <p className="mb-3 font-medium">{response.summary}</p>
      <MetricChart chart={response.chart} />
      <div className="mt-2 text-[13px] text-muted-foreground">
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
