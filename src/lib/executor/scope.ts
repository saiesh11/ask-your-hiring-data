import type { JobFamily } from "@/lib/query-ir";
import type { ExecutionContext } from "./context";

/** Machine-readable description of what a query was confined to. */
export type OrgScope = "org_wide" | { jobFamilies: JobFamily[] };

export interface ResolvedScope {
  /** Every row must belong to one of these families, or null for no constraint. */
  allowedFamilies: JobFamily[] | null;
  /** The family the IR asked for, kept only if it is within the caller's scope. */
  effectiveJobFamily?: JobFamily;
  orgScope: OrgScope;
}

/**
 * The security boundary. Combines the caller's context with the family the IR
 * requested:
 *  - org-wide caller: no family constraint; the IR's family passes through.
 *  - scoped caller asking within scope: narrowed to that one family.
 *  - scoped caller asking outside scope: silently confined to their whole
 *    scope — never rejected, never widened.
 */
export function resolveScope(
  context: ExecutionContext,
  requestedFamily: JobFamily | undefined,
): ResolvedScope {
  if (context.scope === null) {
    return { allowedFamilies: null, effectiveJobFamily: requestedFamily, orgScope: "org_wide" };
  }
  const scope = context.scope;
  if (requestedFamily && scope.includes(requestedFamily)) {
    return {
      allowedFamilies: [requestedFamily],
      effectiveJobFamily: requestedFamily,
      orgScope: { jobFamilies: [requestedFamily] },
    };
  }
  return {
    allowedFamilies: [...scope],
    effectiveJobFamily: undefined,
    orgScope: { jobFamilies: [...scope] },
  };
}
