"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { PageShell, SectionLabel } from "@/components/page-shell";
import { AgingBars } from "./aging-bars";
import { CompositionDonut } from "./composition-donut";
import { GroupedBars } from "./grouped-bars";
import { StatCard } from "./stat-card";
import { TrendArea } from "./trend-area";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/dashboard")
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setError("Could not load the dashboard.");
          return;
        }
        setData((await res.json()) as DashboardData);
      })
      .catch(() => alive && setError("Network error."));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <PageShell title="Dashboard">
        <p className="text-sm text-destructive">{error}</p>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell title="Dashboard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[260px] animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
      </PageShell>
    );
  }

  const scope = data.scope === "org_wide" ? "Org-wide" : data.scope.jobFamilies.join(", ");

  return (
    <PageShell title="Dashboard" description={`${scope} · ${data.window}`}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard {...data.kpis.headcount} />
        <StatCard {...data.kpis.openReqs} />
        <StatCard {...data.kpis.hires} spark={data.hiringTrend.map((p) => p.value)} />
        <StatCard {...data.kpis.avgTimeToFill} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Hiring trend">
          <TrendArea data={data.hiringTrend} />
        </Panel>
        <Panel title="Headcount by band">
          <GroupedBars series={data.headcountByBand} unit="count" />
        </Panel>
        <Panel title="Requisition aging">
          <AgingBars rows={data.reqAging} threshold={data.agingThresholdDays} />
        </Panel>
        <Panel title="Headcount composition">
          <CompositionDonut series={data.composition} />
        </Panel>
      </div>
    </PageShell>
  );
}
