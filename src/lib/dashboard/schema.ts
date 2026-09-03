import * as z from "zod";
import { JOB_FAMILIES } from "@/lib/query-ir";

/**
 * The curated Dashboard payload. Computed straight from one org's hiring data
 * (no LLM, no Query IR) but still validated on the way out, like every other
 * boundary in this codebase.
 */

const KpiSchema = z.strictObject({
  label: z.string(),
  value: z.number(),
  unit: z.enum(["count", "days"]),
});

const PointSchema = z.strictObject({ label: z.string(), value: z.number() });

const AgingRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  jobFamily: z.enum(JOB_FAMILIES),
  ageDays: z.number().int().nonnegative(),
  overThreshold: z.boolean(),
});

export const DashboardScopeSchema = z.union([
  z.literal("org_wide"),
  z.strictObject({ jobFamilies: z.array(z.enum(JOB_FAMILIES)) }),
]);

export const DashboardDataSchema = z.strictObject({
  scope: DashboardScopeSchema,
  window: z.string(),
  kpis: z.strictObject({
    headcount: KpiSchema,
    openReqs: KpiSchema,
    hires: KpiSchema,
    avgTimeToFill: KpiSchema,
  }),
  hiringTrend: z.array(PointSchema),
  composition: z.array(PointSchema),
  headcountByBand: z.array(PointSchema),
  reqAging: z.array(AgingRowSchema),
  agingThresholdDays: z.number().int().positive(),
});

export type DashboardData = z.infer<typeof DashboardDataSchema>;
export type AgingRow = z.infer<typeof AgingRowSchema>;
