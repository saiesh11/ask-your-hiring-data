"use client";

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
import { ScalarTile } from "./scalar-tile";

const HEADCOUNT_METRICS = new Set<OverviewSection["metric"]>(["headcount", "headcount_by_band"]);

/**
 * Picks the visualization that fits the answer:
 *  - scalar          → big-number tile
 *  - grouped headcount → composition donut (share of a whole)
 *  - grouped other    → ranked horizontal bars
 * Single accent colour throughout; a lone series never gets per-bar colours.
 */
export function MetricChart({ response }: { response: OverviewSection }) {
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
