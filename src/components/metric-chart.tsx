"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { OverviewSection } from "@/lib/api";
import { CompositionDonut } from "./composition-donut";
import { DotPlot } from "./dot-plot";
import { GaugeChart } from "./gauge-chart";
import { ScalarTile } from "./scalar-tile";
import { StackedBar } from "./stacked-bar";

export type ChartVariant = "full" | "compact";

/**
 * Picks the visualization that fits the answer — deliberately different per
 * metric so a screen with several answers doesn't repeat one look:
 *
 *  - avg_time_to_fill (scalar) → radial gauge (value on a 0-to-benchmark arc)
 *  - other scalars             → big-number tile
 *  - headcount_by_band         → composition donut, or a slim stacked bar in a
 *                                tight (`compact`) card
 *  - open_reqs (grouped)       → dot plot (a light read for a few families)
 *  - other grouped             → ranked horizontal bars
 */
export function MetricChart({
  response,
  variant = "full",
}: {
  response: OverviewSection;
  variant?: ChartVariant;
}) {
  const { chart, metric } = response;

  let visual: ReactNode;
  if (chart.kind === "single") {
    visual =
      metric === "avg_time_to_fill" ? (
        <GaugeChart value={chart.value} unit={chart.unit} />
      ) : (
        <ScalarTile response={response} />
      );
  } else if (metric === "headcount_by_band") {
    visual =
      variant === "compact" ? (
        <StackedBar series={chart.series} />
      ) : (
        <CompositionDonut series={chart.series} />
      );
  } else if (metric === "open_reqs") {
    visual = <DotPlot series={chart.series} unit={chart.unit} />;
  } else {
    visual = <GroupedBars series={chart.series} unit={chart.unit} />;
  }

  return <div data-testid="metric-chart">{visual}</div>;
}

function GroupedBars({
  series,
  unit,
}: {
  series: { label: string; value: number }[];
  unit: "count" | "days";
}) {
  const height = Math.max(120, series.length * 40 + 24);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={series}
          margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={100}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <Bar
            dataKey="value"
            fill="var(--chart-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => (unit === "days" ? `${v as number}d` : `${v as number}`)}
              style={{
                fontSize: 11,
                fill: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
