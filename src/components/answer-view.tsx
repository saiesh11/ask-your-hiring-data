"use client";

import { useState } from "react";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";
import { MetricChart } from "./metric-chart";

/** Renders one assistant turn — a grounded answer or an explicit refusal. */
export function AnswerView({ response }: { response: AnsweredResponse | RefusedResponse }) {
  if (response.status === "refused") {
    return <RefusalView response={response} />;
  }
  return <AnsweredView response={response} />;
}

function AnsweredView({ response }: { response: AnsweredResponse }) {
  const [showRecords, setShowRecords] = useState(false);
  const { citations } = response;

  return (
    <div data-testid="answered">
      <p style={{ margin: "0 0 0.75rem", fontWeight: 500 }}>{response.summary}</p>
      <MetricChart chart={response.chart} />
      <div style={{ marginTop: "0.5rem", fontSize: 13, color: "var(--dim)" }}>
        <span data-testid="grounded-line">
          Grounded in {citations.recordCount} record{citations.recordCount === 1 ? "" : "s"}
        </span>
        {citations.fields.length > 0 && <> · fields: {citations.fields.join(", ")}</>}
        {citations.recordIds.length > 0 && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setShowRecords((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "var(--brand)",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
              }}
            >
              {showRecords ? "hide records" : "show records"}
            </button>
          </>
        )}
      </div>
      {showRecords && (
        <code
          style={{
            display: "block",
            marginTop: "0.5rem",
            padding: "0.5rem",
            fontSize: 12,
            background: "var(--line)",
            borderRadius: 6,
            wordBreak: "break-all",
          }}
        >
          {citations.recordIds.join(", ")}
        </code>
      )}
    </div>
  );
}

function RefusalView({ response }: { response: RefusedResponse }) {
  return (
    <div data-testid="refused">
      <p style={{ margin: "0 0 0.5rem" }}>{response.message}</p>
      <span
        style={{
          display: "inline-block",
          fontSize: 12,
          color: "var(--dim)",
          border: "1px solid var(--line)",
          borderRadius: 999,
          padding: "0.1rem 0.55rem",
        }}
      >
        {response.reason.replace(/_/g, " ")} · {response.stage.replace(/_/g, " ")}
      </span>
    </div>
  );
}
