import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A figure that should read as data: Geist Mono, tabular figures, so a column
 * of them lines up. Use for every KPI value, delta, table number and record id.
 */
export function Num({
  children,
  unit,
  className,
}: {
  children: ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {children}
      {unit ? <span className="ml-1 text-[0.7em] text-muted-foreground">{unit}</span> : null}
    </span>
  );
}
