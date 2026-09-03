"use client";

import type { AnsweredResponse } from "@/lib/api";
import { CompositionDonut } from "./composition-donut";
import { GroupedBars } from "./grouped-bars";
import { ScalarTile } from "./scalar-tile";

const HEADCOUNT_METRICS = new Set<AnsweredResponse["metric"]>(["headcount", "headcount_by_band"]);

/**
 * Picks the visualization that fits the answer:
 *  - scalar          → big-number tile
 *  - grouped headcount → composition donut (share of a whole)
 *  - grouped other    → ranked horizontal bars
 * Single accent colour throughout; a lone series never gets per-bar colours.
 */
export function MetricChart({ response }: { response: AnsweredResponse }) {
  const { chart } = response;

  const visual =
    chart.kind === "single" ? (
      <ScalarTile response={response} />
    ) : HEADCOUNT_METRICS.has(response.metric) ? (
      <CompositionDonut series={chart.series} />
    ) : (
      <GroupedBars series={chart.series} unit={chart.unit} />
    );

  return <div data-testid="metric-chart">{visual}</div>;
}
