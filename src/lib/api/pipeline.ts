import { execute, resolveSession, UnknownUserError } from "@/lib/executor";
import { getLlmProvider, type LLMProvider } from "@/lib/llm";
import { logger } from "@/lib/observability";
import { interpretLlmProposal } from "@/lib/query-ir";
import { toAnsweredResponse } from "./present";
import { AskRequestSchema, AskResponseSchema, type AskResponse } from "./schema";

/**
 * The one request pipeline. `POST /api/ask` and the eval runner both call this
 * exact function, so the eval suite can never test a different code path than
 * real users hit.
 *
 * Flow: validate request -> resolve session (server-side) -> provider proposes
 * (untrusted) -> interpret against the schema (the choke point) -> refuse, or
 * run the deterministic executor -> shape a grounded, chart-ready response.
 * Every outcome is validated against AskResponseSchema before it leaves.
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
 * Optional overrides. Both the API route and the eval runner call
 * `runAskPipeline(input)` with no overrides, so they exercise the identical
 * path; the `provider` seam exists only so tests can feed the boundary a
 * deliberately malformed proposal.
 */
export interface PipelineDeps {
  provider?: LLMProvider;
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

  let session;
  try {
    session = resolveSession(userId);
  } catch (error) {
    if (error instanceof UnknownUserError) {
      logger.warn("ask_rejected", { requestId, userId, reason: "unknown_user" });
      throw new BadRequestError(`Unknown user: "${userId}".`);
    }
    throw error;
  }

  const provider = deps.provider ?? getLlmProvider();
  const rawProposal = await provider.proposeQueryIR(question);
  const interpretation = interpretLlmProposal(rawProposal);

  const finish = (response: AskResponse): AskResponse => {
    const validated = AskResponseSchema.parse(response); // never ship a malformed response
    logger.info("ask", {
      requestId,
      userId,
      role: session.role,
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
    });
  }

  if (interpretation.kind === "refusal") {
    return finish({
      status: "refused",
      stage: "model_refusal",
      reason: interpretation.refusal.reason,
      message: interpretation.refusal.message,
    });
  }

  const result = execute(interpretation.queryIR, session);
  if (!result.ok) {
    return finish({
      status: "refused",
      stage: "executor",
      reason: result.reason,
      message: result.message,
      appliedFilters: result.appliedFilters,
    });
  }

  return finish(toAnsweredResponse(result));
}
