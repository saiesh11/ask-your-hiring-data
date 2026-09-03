import type { MemberActor } from "./members";
import {
  NoOrganizationError,
  requireContext,
  UnauthenticatedError,
  type RequestContext,
} from "./context";

export type GuardResult =
  { ok: true; actor: MemberActor; ctx: RequestContext } | { ok: false; response: Response };

/** Auth + org resolution for a route handler. Not exported from the barrel. */
export async function guardOrgRoute(): Promise<GuardResult> {
  try {
    const ctx = await requireContext();
    return {
      ok: true,
      ctx,
      actor: { orgId: ctx.org.id, userId: ctx.user.id, role: ctx.membership.role },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return { ok: false, response: Response.json({ error: "Not signed in." }, { status: 401 }) };
    }
    if (error instanceof NoOrganizationError) {
      return { ok: false, response: Response.json({ error: "No organization." }, { status: 403 }) };
    }
    throw error;
  }
}
