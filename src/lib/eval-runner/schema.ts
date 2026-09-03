import * as z from "zod";
import { FiltersSchema, GROUP_BY_FIELDS, METRICS } from "@/lib/query-ir";
import { OrgScopeSchema, REFUSAL_RESPONSE_REASONS, REFUSAL_STAGES } from "@/lib/api";

/**
 * The eval set is the AI-quality gate. Each case is validated against this
 * schema at load time so a malformed case fails loudly instead of silently
 * passing.
 */

const AnsweredExpectation = z.strictObject({
  refused: z.literal(false),
  metric: z.enum(METRICS),
  groupBy: z.enum(GROUP_BY_FIELDS).optional(),
  /** Filters the executor should have applied (after scoping). */
  appliedFilters: FiltersSchema.optional(),
  /** The org scope the query should have run under. */
  scope: OrgScopeSchema.optional(),
  /** Optional hard anchors — a literal the pipeline value/groups must also equal. */
  value: z.number().optional(),
  groups: z.array(z.strictObject({ key: z.string(), value: z.number() })).optional(),
});

const RefusedExpectation = z.strictObject({
  refused: z.literal(true),
  stage: z.enum(REFUSAL_STAGES).optional(),
  reason: z.enum(REFUSAL_RESPONSE_REASONS).optional(),
});

export const EvalCaseSchema = z.strictObject({
  id: z.string().min(1),
  question: z.string().min(1),
  userId: z.string().min(1),
  note: z.string().optional(),
  expected: z.union([AnsweredExpectation, RefusedExpectation]),
});
export type EvalCase = z.infer<typeof EvalCaseSchema>;

export const EvalSetSchema = z.array(EvalCaseSchema).min(15).max(25);
export type EvalSet = z.infer<typeof EvalSetSchema>;
