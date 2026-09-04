"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { Num } from "./num";

/**
 * A single value on a 260° arc — used for "average time to fill", where the
 * number lands somewhere on a 0-to-benchmark scale rather than being a share of
 * a whole. Benchmark defaults to a sensible ceiling above the value.
 */
export function GaugeChart({
  value,
  unit,
  benchmark,
}: {
  value: number;
  unit: "count" | "days";
  benchmark?: number;
}) {
  const max = benchmark ?? Math.max(30, Math.ceil((value * 1.35) / 10) * 10);
  const data = [{ name: "v", value: Math.min(value, max) }];

  return (
    <div className="relative mx-auto h-[150px] w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={220}
          endAngle={-40}
          barSize={14}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} axisLine={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={8}
            fill="var(--chart-1)"
            background={{ fill: "var(--muted)" }}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center">
        <Num className="text-3xl font-semibold tracking-tight text-primary">
          {unit === "days" ? value.toFixed(1) : value.toLocaleString()}
        </Num>
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {unit === "days" ? "days · " : ""}of {max}
        </span>
      </div>
    </div>
  );
}
