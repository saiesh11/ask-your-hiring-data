"use client";

import { Num } from "./num";

/** One hue at descending opacity, so a stack of segments still reads as teal. */
const segOpacity = (i: number) => Math.max(0.3, 1 - i * 0.16);

/**
 * A single 100%-width horizontal bar split into segments — a compact take on
 * "composition of a whole" for tight spaces (an overview card), where the donut
 * would crowd. Legend wraps beneath.
 */
export function StackedBar({ series }: { series: { label: string; value: number }[] }) {
  const total = series.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <div className="py-1">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full">
        {series.map((d, i) => (
          <span
            key={d.label}
            style={{
              width: `${(d.value / total) * 100}%`,
              background: "var(--chart-1)",
              opacity: segOpacity(i),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {series.map((d, i) => (
          <li key={d.label} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: "var(--chart-1)", opacity: segOpacity(i) }}
            />
            <span className="text-muted-foreground">{d.label}</span>
            <Num className="text-muted-foreground">{d.value.toLocaleString()}</Num>
          </li>
        ))}
      </ul>
    </div>
  );
}
