import type { JobFamily } from "@/lib/query-ir";

/**
 * The resolved analytics access for one request. `scope: null` = org-wide (no
 * job-family constraint); a list = the request is confined to those families
 * (a recruiter / viewer). Always resolved server-side from the caller's
 * membership — never from the request body or the LLM's output.
 */
export interface ExecutionContext {
  scope: JobFamily[] | null;
}

export const ORG_WIDE: ExecutionContext = { scope: null };

export function scopedTo(families: readonly JobFamily[]): ExecutionContext {
  return { scope: [...families] };
}
