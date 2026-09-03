import type { ZodError } from "zod";
import { LlmProposalSchema, type QueryIR, type Refusal } from "./schema";

/**
 * The result of interpreting the provider's raw, untrusted output.
 *
 * `invalid` and `refusal` both become a refusal *response* in the pipeline, but
 * are kept distinct here so structured logs and the eval suite can tell
 * "the model explicitly declined" from "the model produced something that isn't
 * a valid proposal at all".
 */
export type ProposalInterpretation =
  | { kind: "query_ir"; queryIR: QueryIR }
  | { kind: "refusal"; refusal: Refusal }
  | { kind: "invalid"; issues: string[] };

/** Flatten a ZodError into short, log-friendly `path: message` strings. */
export function formatIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/**
 * Turn raw LLM output into exactly one of three outcomes. This is the single
 * choke point between "the model said something" and "deterministic code runs".
 * Nothing downstream ever sees the raw value.
 */
export function interpretLlmProposal(raw: unknown): ProposalInterpretation {
  const parsed = LlmProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: "invalid", issues: formatIssues(parsed.error) };
  }
  if ("refusal" in parsed.data) {
    return { kind: "refusal", refusal: parsed.data };
  }
  return { kind: "query_ir", queryIR: parsed.data };
}
