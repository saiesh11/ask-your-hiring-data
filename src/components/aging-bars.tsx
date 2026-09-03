"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { AgingRow } from "@/lib/dashboard";

/** Open requisitions by age in days; over the threshold turns amber. */
export function AgingBars({ rows, threshold }: { rows: AgingRow[]; threshold: number }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No open requisitions.</p>;
  }
  const height = Math.max(140, rows.length * 32 + 24);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 40, bottom: 16, left: 8 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <ReferenceLine
            x={threshold}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            label={{
              value: `${threshold}d`,
              position: "top",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
          <Bar dataKey="ageDays" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.id} fill={r.overThreshold ? "var(--chart-5)" : "var(--chart-1)"} />
            ))}
            <LabelList
              dataKey="ageDays"
              position="right"
              formatter={(v: unknown) => `${v as number}d`}
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
