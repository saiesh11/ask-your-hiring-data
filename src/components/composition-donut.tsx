"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Num } from "./num";

type Slice = { label: string; value: number };

/** Opacity ramp so one hue (brand teal) carries every slice. */
const sliceOpacity = (i: number) => Math.max(0.28, 1 - i * 0.17);

/**
 * Headcount composition: a donut with the total in the middle and a labelled
 * legend. Single-hue — slices are the brand colour at descending opacity.
 *
 * The legend is width-capped (inline, so the dev bundler can't drop it) and its
 * `%` / value columns are fixed-width, so the numbers stay next to the label
 * instead of drifting to the edge of a wide card.
 */
export function CompositionDonut({ series }: { series: Slice[] }) {
  const total = series.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[176px] w-[176px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={series}
              dataKey="value"
              nameKey="label"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={series.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {series.map((d, i) => (
                <Cell key={d.label} fill="var(--chart-1)" fillOpacity={sliceOpacity(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <Num className="text-xl font-semibold">{total.toLocaleString()}</Num>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            total
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2 text-sm" style={{ maxWidth: "16rem" }}>
        {series.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px] bg-[var(--chart-1)]"
              style={{ opacity: sliceOpacity(i) }}
            />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="flex shrink-0 items-baseline gap-2.5">
              <Num className="text-xs text-muted-foreground">
                {Math.round((d.value / total) * 100)}%
              </Num>
              <span
                className="inline-block text-right font-mono tabular-nums"
                style={{ width: "2rem" }}
              >
                {d.value.toLocaleString()}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
