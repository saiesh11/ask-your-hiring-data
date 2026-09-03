/**
 * The one interface between the application and any language model.
 *
 * The return type is deliberately `unknown`: whatever a provider hands back is
 * untrusted and unvalidated. It only becomes usable after
 * `interpretLlmProposal` (src/lib/query-ir) parses it against the schema at the
 * pipeline boundary. The executor, the API route, and the eval runner never
 * touch a provider directly — they go through the factory (`./factory`).
 */
export interface LLMProvider {
  /** Propose a structured query representation for a natural-language question. */
  proposeQueryIR(question: string): Promise<unknown>;
}
