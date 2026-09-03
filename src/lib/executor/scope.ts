import type { Filters } from "@/lib/query-ir";
import type { Session } from "./session";

/**
 * Server-side role scoping — the security boundary. Applied inside the executor,
 * first, on every query. It is NOT implied by the prompt and NOT trusted to the
 * request body.
 *
 * - CHRO: org-wide, filters pass through untouched.
 * - Recruiter: `jobFamily` is FORCED to their own family, overriding whatever
 *   was requested. We do not reject a cross-family request — we silently narrow
 *   it and let the (possibly empty) result stand.
 *
 * Idempotent: `scopeFilters(scopeFilters(f, s), s)` === `scopeFilters(f, s)`, so
 * the eval suite can re-run it when independently recomputing expected values.
 */
export function scopeFilters(filters: Filters, session: Session): Filters {
  if (session.role === "chro") {
    return { ...filters };
  }
  return { ...filters, jobFamily: session.jobFamilyName };
}
