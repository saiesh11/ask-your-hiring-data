import * as z from "zod";
import { FiltersSchema, METRICS } from "@/lib/query-ir";

/**
 * The I/O contract for `POST /api/ask` and the eval runner. Both sides are Zod
 * schemas: the request body is parsed on the way in, the response is parsed on
 * the way out, so a bug that produces a malformed response is caught in tests
 * and never shipped.
 */

export const AskRequestSchema = z.strictObject({
  userId: z.string().min(1),
  question: z.string().trim().min(1).max(500),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

// --- chart-ready payload ------------------------------------------------

export const ChartPayloadSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("single"),
    unit: z.enum(["count", "days"]),
    label: z.string(),
    value: z.number(),
  }),
  z.strictObject({
    kind: z.literal("bar"),
    unit: z.enum(["count", "days"]),
    series: z.array(z.strictObject({ label: z.string(), value: z.number() })),
  }),
]);
export type ChartPayload = z.infer<typeof ChartPayloadSchema>;

// --- citations --------------------------------------------------------

export const CitationsSchema = z.strictObject({
  recordIds: z.array(z.string()),
  fields: z.array(z.string()),
  recordCount: z.number().int().nonnegative(),
});
export type Citations = z.infer<typeof CitationsSchema>;

// --- response --------------------------------------------------------

/** Why an answer was refused. Superset of the model's refusal reasons. */
export const REFUSAL_RESPONSE_REASONS = [
  "out_of_scope",
  "ambiguous",
  "unsupported_metric",
  "uninterpretable", // the model's proposal failed schema validation
  "no_matching_records",
  "unsupported_filter_for_metric",
] as const;

/** Where in the pipeline the refusal originated. */
export const REFUSAL_STAGES = ["schema_validation", "model_refusal", "executor"] as const;

const AnsweredSchema = z.strictObject({
  status: z.literal("answered"),
  metric: z.enum(METRICS),
  kind: z.enum(["scalar", "grouped"]),
  value: z.number().optional(),
  groups: z.array(z.strictObject({ key: z.string(), value: z.number() })).optional(),
  unit: z.enum(["count", "days"]),
  appliedFilters: FiltersSchema,
  citations: CitationsSchema,
  chart: ChartPayloadSchema,
  summary: z.string(),
});

const RefusedSchema = z.strictObject({
  status: z.literal("refused"),
  stage: z.enum(REFUSAL_STAGES),
  reason: z.enum(REFUSAL_RESPONSE_REASONS),
  message: z.string(),
  // Present only when the pipeline reached the executor.
  appliedFilters: FiltersSchema.optional(),
});

export const AskResponseSchema = z.discriminatedUnion("status", [AnsweredSchema, RefusedSchema]);
export type AskResponse = z.infer<typeof AskResponseSchema>;
export type AnsweredResponse = z.infer<typeof AnsweredSchema>;
export type RefusedResponse = z.infer<typeof RefusedSchema>;
