"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPayload } from "@/lib/api";

/**
 * Minimal Recharts rendering of the chart-ready payload: one bar for a scalar
 * answer, a bar per group for a grouped answer. Single accent colour — a single
 * data series doesn't get per-bar colours.
 */
export function MetricChart({ chart }: { chart: ChartPayload }) {
  const data =
    chart.kind === "single" ? [{ label: chart.label, value: chart.value }] : chart.series;
  const suffix = chart.unit === "days" ? " days" : "";

  return (
    <div data-testid="metric-chart" style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted)" }} />
          <YAxis
            allowDecimals={chart.unit === "days"}
            width={44}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--border)", opacity: 0.3 }}
            contentStyle={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(value) => `${value ?? ""}${suffix}`}
          />
          <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={72} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
