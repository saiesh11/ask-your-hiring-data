"use client";

import { Num } from "./num";

/**
 * A lollipop / dot plot — a lighter read than solid bars for comparing a few
 * categories (open requisitions by family). One hue; the track carries the
 * scale, the dot marks the value.
 */
export function DotPlot({
  series,
  unit,
}: {
  series: { label: string; value: number }[];
  unit: "count" | "days";
}) {
  const max = Math.max(1, ...series.map((d) => d.value));

  return (
    <ul className="flex flex-col gap-2.5 py-1 text-sm">
      {series.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <li key={d.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-muted-foreground">{d.label}</span>
            <span className="relative h-1.5 flex-1 rounded-full bg-muted">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: "var(--chart-1)", opacity: 0.25 }}
              />
              <span
                className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full ring-2 ring-[var(--card)]"
                style={{ left: `calc(${pct}% - 6px)`, background: "var(--chart-1)" }}
              />
            </span>
            <Num className="w-8 shrink-0 text-right text-muted-foreground">
              {unit === "days" ? `${d.value}d` : d.value.toLocaleString()}
            </Num>
          </li>
        );
      })}
    </ul>
  );
}
