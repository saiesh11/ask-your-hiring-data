import { Num } from "./num";

/** A KPI tile: mono label, big tabular value, optional sparkline. */
export function StatCard({
  label,
  value,
  unit,
  spark,
}: {
  label: string;
  value: number;
  unit: "count" | "days";
  spark?: number[];
}) {
  const display = unit === "days" ? value.toFixed(1) : Math.round(value).toLocaleString();

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
      <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-2xl leading-none font-semibold tracking-tight">
        <Num unit={unit === "days" ? "days" : undefined}>{display}</Num>
      </span>
      {spark && spark.length > 1 ? <Sparkline data={spark} /> : null}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const w = 100;
  const h = 24;
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : 0;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1]?.split(",") ?? ["0", "0"];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill="var(--chart-1)" />
    </svg>
  );
}
