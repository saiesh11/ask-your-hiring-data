import { execute, executeOverview, resolveScope, type ExecutionContext } from "@/lib/executor";
import type { HiringDataSource } from "@/lib/hiring-data";
import { getLlmProvider, type LLMProvider } from "@/lib/llm";
import { logger } from "@/lib/observability";
import { interpretLlmProposal } from "@/lib/query-ir";
import { toAnsweredResponse, toOverviewResponse } from "./present";
import { AskRequestSchema, AskResponseSchema, type AskResponse } from "./schema";

/**
 * The one request pipeline. `POST /api/ask` and the eval runner both call this
 * exact function. The caller resolves the execution context + data source
 * server-side (from the session's org membership, or synthetic eval principals)
 * and hands them in — the pipeline never reads a role from the request body.
 *
 * Flow: validate the question -> provider proposes (untrusted) -> interpret
 * against the schema (the choke point) -> refuse, or run the deterministic
 * executor against that context and that org's data -> shape a grounded,
 * chart-ready response. Every outcome is validated against AskResponseSchema
 * before it leaves.
 */

export class BadRequestError extends Error {
  constructor(
    message: string,
    public readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "BadRequestError";
  }
}

const UNINTERPRETABLE_MESSAGE =
  "I couldn't turn that into a supported query. Try asking about hire count, open " +
  "requisitions, headcount, average time to fill, or headcount by band.";

export interface PipelineDeps {
  /** The caller's analytics scope, resolved server-side. */
  context: ExecutionContext;
  /** Hiring data for the caller's org. */
  dataSource: HiringDataSource;
  /** Defaults to the provider factory; a seam for tests. */
  provider?: LLMProvider;
  /** Extra fields for the structured log line (userId, orgId, role). */
  logMeta?: Record<string, unknown>;
}

export async function runAskPipeline(input: unknown, deps: PipelineDeps): Promise<AskResponse> {
  const startedAt = Date.now();
  const requestId = globalThis.crypto.randomUUID();

  const parsed = AskRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestError(
      "Invalid request body.",
      parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  const { question } = parsed.data;

  // The caller's scope is known regardless of the query — attach it to every
  // response, including early refusals.
  const scope = resolveScope(deps.context, undefined).orgScope;

  const provider = deps.provider ?? getLlmProvider();
  const rawProposal = await provider.proposeQueryIR(question);
  const interpretation = interpretLlmProposal(rawProposal);

  // What the model proposed, before any deterministic code ran — so the
  // model→code boundary is auditable per request, not just implied.
  const proposal =
    interpretation.kind === "query_ir"
      ? {
          kind: "query_ir",
          metric: interpretation.queryIR.metric,
          groupBy: interpretation.queryIR.groupBy ?? null,
        }
      : interpretation.kind === "overview"
        ? { kind: "overview", filters: interpretation.overviewIR.filters }
        : interpretation.kind === "refusal"
          ? { kind: "refusal", reason: interpretation.refusal.reason }
          : { kind: "invalid", issues: interpretation.issues };

  const finish = (response: AskResponse): AskResponse => {
    const validated = AskResponseSchema.parse(response);
    logger.info("ask", {
      requestId,
      ...deps.logMeta,
      scope,
      proposal,
      outcome: validated.status,
      ...(validated.status === "refused"
        ? { stage: validated.stage, reason: validated.reason }
        : validated.status === "overview"
          ? {
              sections: validated.sections.map((s) => s.metric),
              appliedFilters: validated.appliedFilters,
              recordCount: validated.citations.recordCount,
            }
          : {
              metric: validated.metric,
              appliedFilters: validated.appliedFilters,
              recordCount: validated.citations.recordCount,
            }),
      ms: Date.now() - startedAt,
    });
    return validated;
  };

  if (interpretation.kind === "invalid") {
    return finish({
      status: "refused",
      stage: "schema_validation",
      reason: "uninterpretable",
      message: UNINTERPRETABLE_MESSAGE,
      scope,
    });
  }

  if (interpretation.kind === "refusal") {
    return finish({
      status: "refused",
      stage: "model_refusal",
      reason: interpretation.refusal.reason,
      message: interpretation.refusal.message,
      scope,
    });
  }

  const data = await deps.dataSource.load();

  if (interpretation.kind === "overview") {
    const overview = executeOverview(interpretation.overviewIR, deps.context, data);
    if (!overview.ok) {
      return finish({
        status: "refused",
        stage: "executor",
        reason: overview.reason,
        message: overview.message,
        scope: overview.scope,
        appliedFilters: overview.appliedFilters,
      });
    }
    return finish(toOverviewResponse(overview));
  }

  const result = execute(interpretation.queryIR, deps.context, data);

  if (!result.ok) {
    return finish({
      status: "refused",
      stage: "executor",
      reason: result.reason,
      message: result.message,
      scope: result.scope,
      appliedFilters: result.appliedFilters,
    });
  }

  return finish(toAnsweredResponse(result));
}
