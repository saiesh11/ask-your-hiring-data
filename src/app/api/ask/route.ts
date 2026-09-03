import { BadRequestError, runAskPipeline } from "@/lib/api";
import { logger } from "@/lib/observability";
import { NoOrganizationError, requireContext, UnauthenticatedError } from "@/lib/tenancy/context";

/**
 * POST /api/ask — the analytics endpoint. The caller's org, role, and
 * job-family scope come from `requireContext()` (the session), never the body.
 */
export async function POST(request: Request): Promise<Response> {
  let ctx;
  try {
    ctx = await requireContext();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }
    if (error instanceof NoOrganizationError) {
      return Response.json({ error: "No organization." }, { status: 403 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const response = await runAskPipeline(body, {
      context: ctx.executionContext,
      dataSource: ctx.hiringData,
      logMeta: { userId: ctx.user.id, orgId: ctx.org.id, role: ctx.membership.role },
    });
    return Response.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return Response.json({ error: error.message, issues: error.issues }, { status: 400 });
    }
    logger.error("api_ask_unhandled", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal error." }, { status: 500 });
  }
}
