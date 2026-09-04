import evalSetRaw from "./eval-set.json";
import { EvalSetSchema, type EvalCase } from "./schema";
import { runAskPipeline } from "@/lib/api";
import { execute, resolveSession } from "@/lib/executor";
import { getLlmProvider } from "@/lib/llm";
import type { QueryIR } from "@/lib/query-ir";

/**
 * The eval gate is a deterministic regression check, so it is pinned to the
 * MockProvider regardless of the ambient environment — a network model would
 * make the gate non-deterministic and could bill the user on `pnpm eval`.
 */
const EVAL_PROVIDER = getLlmProvider({});

/**
 * Runs each eval case through the EXACT pipeline the API route uses, then — for
 * answered cases — independently recomputes the expected value by calling the
 * executor directly with the case's applied filters under the same session, and
 * asserts the two agree. That catches a regression in the mock, the schema
 * boundary, role scoping, or presentation — not just "did the model emit JSON".
 */

export type EvalCaseResult = {
  id: string;
  question: string;
  userId: string;
  passed: boolean;
  failures: string[];
  observed: string;
};

export type EvalRunSummary = {
  total: number;
  passed: number;
  failed: number;
  results: EvalCaseResult[];
};

export function loadEvalSet(): EvalCase[] {
  return EvalSetSchema.parse(evalSetRaw);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return val;
  });
}

function equal(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export async function runEvalCase(evalCase: EvalCase): Promise<EvalCaseResult> {
  const { id, question, userId, expected } = evalCase;
  const failures: string[] = [];
  const response = await runAskPipeline({ userId, question }, { provider: EVAL_PROVIDER });

  if (expected.refused) {
    if (response.status !== "refused") {
      failures.push(`expected a refusal, got "${response.status}"`);
    } else {
      if (expected.stage && response.stage !== expected.stage) {
        failures.push(`stage: expected "${expected.stage}", got "${response.stage}"`);
      }
      if (expected.reason && response.reason !== expected.reason) {
        failures.push(`reason: expected "${expected.reason}", got "${response.reason}"`);
      }
    }
  } else if (response.status !== "answered") {
    failures.push(
      `expected an answer, got "${response.status}"` +
        (response.status === "refused" ? ` (${response.reason}: ${response.message})` : ""),
    );
  } else {
    if (response.metric !== expected.metric) {
      failures.push(`metric: expected "${expected.metric}", got "${response.metric}"`);
    }
    if (!equal(response.appliedFilters, expected.appliedFilters)) {
      failures.push(
        `appliedFilters: expected ${stableStringify(expected.appliedFilters)}, got ${stableStringify(response.appliedFilters)}`,
      );
    }

    // Independent recompute via the executor directly.
    const ir: QueryIR = {
      version: 1,
      metric: expected.metric,
      filters: expected.appliedFilters,
      ...(expected.groupBy ? { groupBy: expected.groupBy } : {}),
    };
    const recomputed = execute(ir, resolveSession(userId));
    if (!recomputed.ok) {
      failures.push(`independent recompute did not produce an answer (${recomputed.reason})`);
    } else if (recomputed.kind === "scalar" && response.kind === "scalar") {
      if (recomputed.value !== response.value) {
        failures.push(`value: recompute=${recomputed.value}, pipeline=${response.value}`);
      }
      if (expected.value !== undefined && response.value !== expected.value) {
        failures.push(`value anchor: expected ${expected.value}, pipeline=${response.value}`);
      }
    } else if (recomputed.kind === "grouped" && response.kind === "grouped") {
      if (!equal(recomputed.groups, response.groups)) {
        failures.push(
          `groups: recompute=${stableStringify(recomputed.groups)}, pipeline=${stableStringify(response.groups)}`,
        );
      }
      if (expected.groups && !equal(response.groups, expected.groups)) {
        failures.push(`groups anchor mismatch`);
      }
    } else {
      failures.push(`kind: recompute="${recomputed.kind}", pipeline="${response.kind}"`);
    }

    // Groundedness: an answer must cite records, name fields, and the cited set
    // must be exactly the records the executor independently counted.
    if (recomputed.ok) {
      const { recordCount, recordIds, fields } = response.citations;
      if (recordCount !== recordIds.length) {
        failures.push(
          `citations.recordCount (${recordCount}) != recordIds.length (${recordIds.length})`,
        );
      }
      if (recordCount === 0) failures.push("answered but cited zero records");
      if (fields.length === 0) failures.push("answered but named no fields");
      const cited = [...new Set(recordIds)].sort();
      const counted = [...new Set(recomputed.citations.recordIds)].sort();
      if (!equal(cited, counted)) {
        failures.push(
          `citations mismatch: cited ${cited.length} record(s), executor counted ${counted.length}`,
        );
      }
    }
  }

  const observed =
    response.status === "answered"
      ? `answered ${response.metric} ${response.kind === "scalar" ? String(response.value) : stableStringify(response.groups)} filters=${stableStringify(response.appliedFilters)}`
      : response.status === "overview"
        ? `overview [${response.sections.map((s) => s.metric).join(", ")}] filters=${stableStringify(response.appliedFilters)}`
        : `refused ${response.stage}/${response.reason}`;

  return { id, question, userId, passed: failures.length === 0, failures, observed };
}

export async function runEvalSuite(cases: EvalCase[] = loadEvalSet()): Promise<EvalRunSummary> {
  const results: EvalCaseResult[] = [];
  for (const evalCase of cases) {
    results.push(await runEvalCase(evalCase));
  }
  const passed = results.filter((r) => r.passed).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}
