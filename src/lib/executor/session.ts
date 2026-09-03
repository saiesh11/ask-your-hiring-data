import { getDemoUserById, getJobFamilyById } from "@/lib/data";
import type { JobFamily as JobFamilyName } from "@/lib/query-ir";

/**
 * A server-resolved identity. This is the ONLY source of role and scope — it is
 * built from a trusted lookup keyed by `userId`, never from the request body and
 * never from anything the LLM produced.
 *
 * Modeled as a discriminated union so the type system guarantees the invariant
 * "a recruiter has a job family, the CHRO does not".
 */
export type Session =
  | { userId: string; role: "chro" }
  | { userId: string; role: "recruiter"; jobFamilyName: JobFamilyName };

export class UnknownUserError extends Error {
  constructor(public readonly userId: string) {
    super(`Unknown user: "${userId}"`);
    this.name = "UnknownUserError";
  }
}

/**
 * Resolve a demo user id to a {@link Session}. Throws {@link UnknownUserError}
 * for an unrecognized id; the pipeline turns that into a refusal rather than
 * guessing a role.
 */
export function resolveSession(userId: string): Session {
  const user = getDemoUserById(userId);
  if (!user) {
    throw new UnknownUserError(userId);
  }
  if (user.role === "chro") {
    return { userId: user.id, role: "chro" };
  }
  // The fixture schema guarantees a recruiter has a jobFamilyId; resolve its name.
  const family = user.jobFamilyId ? getJobFamilyById(user.jobFamilyId) : undefined;
  if (!family) {
    // Unreachable: DatasetSchema validates this at load time.
    throw new Error(`Recruiter "${user.id}" has an unresolvable job family`);
  }
  return { userId: user.id, role: "recruiter", jobFamilyName: family.name };
}
