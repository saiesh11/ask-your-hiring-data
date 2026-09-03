import * as z from "zod";

/**
 * The Query IR is the ONLY structure the LLM is permitted to produce. It is a
 * closed, versioned contract: the model picks values from fixed menus, it never
 * writes a query string and never invents a field. The raw model output is
 * `unknown` until it is run through {@link LlmProposalSchema} with `safeParse`
 * at the pipeline boundary — before any dataset code executes.
 *
 * Versioning: the payload carries `version: 1`. A future revision becomes a
 * `z.discriminatedUnion("version", [QueryIrV1Schema, QueryIrV2Schema])` so old
 * clients keep working against a pinned shape.
 */
export const QUERY_IR_VERSION = 1 as const;

// --- Closed vocabularies ----------------------------------------------------
// Single source of truth for everything a user is allowed to ask about. The
// synthetic dataset (src/lib/data) is generated to match JOB_FAMILIES and BANDS
// exactly, so a validated filter value always resolves against real records.

export const METRICS = [
  "hire_count",
  "open_reqs",
  "headcount",
  "avg_time_to_fill",
  "headcount_by_band",
] as const;

export const JOB_FAMILIES = ["Engineering", "Sales", "Product", "Design", "Marketing"] as const;

export const BANDS = ["Junior", "Mid", "Senior", "Staff"] as const;

export const GROUP_BY_FIELDS = ["band", "jobFamily"] as const;

export const REFUSAL_REASONS = ["out_of_scope", "ambiguous", "unsupported_metric"] as const;

export type Metric = (typeof METRICS)[number];
export type JobFamily = (typeof JOB_FAMILIES)[number];
export type Band = (typeof BANDS)[number];
export type GroupByField = (typeof GROUP_BY_FIELDS)[number];
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

// --- Schemas --------------------------------------------------------------
// `z.strictObject` === `z.object(...).strict()` in Zod 4: any unexpected key
// (an injected field, a formula, a nested query operator like `$where`) is a
// hard parse error, not silently stripped.

export const DateRangeSchema = z
  .strictObject({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((range) => range.from <= range.to, {
    // `YYYY-MM-DD` strings sort lexicographically === chronologically.
    error: "filters.dateRange.from must be on or before filters.dateRange.to",
  });

export const FiltersSchema = z.strictObject({
  jobFamily: z.enum(JOB_FAMILIES).optional(),
  band: z.enum(BANDS).optional(),
  dateRange: DateRangeSchema.optional(),
});

export const QueryIRSchema = z.strictObject({
  version: z.literal(QUERY_IR_VERSION),
  metric: z.enum(METRICS),
  filters: FiltersSchema,
  groupBy: z.enum(GROUP_BY_FIELDS).optional(),
});

export const RefusalSchema = z.strictObject({
  refusal: z.literal(true),
  reason: z.enum(REFUSAL_REASONS),
  message: z.string().min(1),
});

/**
 * The union the raw LLM output is parsed against. `.strict()` on both members
 * means a value can satisfy at most one of them. Anything that fails this — a
 * non-JSON scalar, a bare SQL string, an object with one extra key — is a hard
 * failure that MUST be treated as a refusal upstream. It is never coerced,
 * repaired, or partially salvaged.
 */
export const LlmProposalSchema = z.union([QueryIRSchema, RefusalSchema]);

export type DateRange = z.infer<typeof DateRangeSchema>;
export type Filters = z.infer<typeof FiltersSchema>;
export type QueryIR = z.infer<typeof QueryIRSchema>;
export type Refusal = z.infer<typeof RefusalSchema>;
export type LlmProposal = z.infer<typeof LlmProposalSchema>;
