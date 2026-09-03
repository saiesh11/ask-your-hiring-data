import type { AnsweredResponse } from "@/lib/api";
import { Num } from "./num";

const METRIC_LABEL: Record<AnsweredResponse["metric"], string> = {
  hire_count: "Hires",
  open_reqs: "Open requisitions",
  headcount: "Headcount",
  avg_time_to_fill: "Time to fill",
  headcount_by_band: "Headcount",
};

function fmt(value: number, unit: AnsweredResponse["unit"]): string {
  return unit === "days" ? value.toFixed(1) : Math.round(value).toLocaleString();
}

/** The grounded scalar answer as a single big-number tile. */
export function ScalarTile({ response }: { response: AnsweredResponse }) {
  const label = METRIC_LABEL[response.metric];
  const scope =
    response.scope === "org_wide"
      ? "org-wide"
      : response.scope.jobFamilies.join(", ") || "org-wide";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
        {label} · {scope}
      </div>
      <div className="mt-1.5 text-3xl font-semibold tracking-tight text-primary">
        <Num unit={response.unit === "days" ? "days" : undefined}>
          {fmt(response.value ?? 0, response.unit)}
        </Num>
      </div>
    </div>
  );
}
