import { execute, resolveScope } from "@/lib/executor";
import { InMemoryHiringDataSource, type HiringDataSource } from "@/lib/hiring-data";
import { getLlmProvider, type LLMProvider } from "@/lib/llm";
import { logger } from "@/lib/observability";
import { interpretLlmProposal } from "@/lib/query-ir";
import { resolveDevPrincipal, UnknownPrincipalError } from "./dev-context";
import { toAnsweredResponse } from "./present";
import { AskRequestSchema, AskResponseSchema, type AskResponse } from "./schema";

/**
 * The one request pipeline. `POST /api/ask` and the eval runner both call this
 * exact function, so the eval suite can never test a different code path than
 * real users hit.
 *
 * Flow: validate request -> resolve the caller's execution context server-side
 * -> provider proposes (untrusted) -> interpret against the schema (the choke
 * point) -> refuse, or run the deterministic executor against that context and
 * that org's data -> shape a grounded, chart-ready response. Every outcome is
 * validated against AskResponseSchema before it leaves.
 *
 * TODO(S5): resolve the caller from the Auth.js session + a DB membership
 * lookup instead of the `resolveDevPrincipal` shim, and read the org's data via
 * PrismaHiringDataSource.
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

/**
 * Optional overrides. The API route and the eval runner call `runAskPipeline`
 * with no overrides so they exercise the identical path; the seams exist only
 * for tests (a malformed proposal; a fixed data source).
 */
export interface PipelineDeps {
  provider?: LLMProvider;
  dataSource?: HiringDataSource;
}

export async function runAskPipeline(
  input: unknown,
  deps: PipelineDeps = {},
): Promise<AskResponse> {
  const startedAt = Date.now();
  const requestId = globalThis.crypto.randomUUID();

  const parsedRequest = AskRequestSchema.safeParse(input);
  if (!parsedRequest.success) {
    throw new BadRequestError(
      "Invalid request body.",
      parsedRequest.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  const { userId, question } = parsedRequest.data;

  let principal;
  try {
    principal = resolveDevPrincipal(userId);
  } catch (error) {
    if (error instanceof UnknownPrincipalError) {
      logger.warn("ask_rejected", { requestId, userId, reason: "unknown_user" });
      throw new BadRequestError(`Unknown user: "${userId}".`);
    }
    throw error;
  }

  // The caller's scope is known regardless of the query — attach it to every
  // response, including early refusals.
  const scope = resolveScope(principal.context, undefined).orgScope;

  const provider = deps.provider ?? getLlmProvider();
  const rawProposal = await provider.proposeQueryIR(question);
  const interpretation = interpretLlmProposal(rawProposal);

  const finish = (response: AskResponse): AskResponse => {
    const validated = AskResponseSchema.parse(response); // never ship a malformed response
    logger.info("ask", {
      requestId,
      userId,
      role: principal.role,
      outcome: validated.status,
      ...(validated.status === "refused"
        ? { stage: validated.stage, reason: validated.reason }
        : { metric: validated.metric, recordCount: validated.citations.recordCount }),
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

  const source = deps.dataSource ?? new InMemoryHiringDataSource(principal.seed);
  const data = await source.load();
  const result = execute(interpretation.queryIR, principal.context, data);

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
