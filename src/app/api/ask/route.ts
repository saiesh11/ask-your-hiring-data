import { BadRequestError, runAskPipeline } from "@/lib/api";
import { logger } from "@/lib/observability";
import { guardOrgRoute } from "@/lib/tenancy/route-guard";

/**
 * POST /api/ask — the analytics endpoint. The caller's org, role, and
 * job-family scope come from the session (`guardOrgRoute`), never the body.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const response = await runAskPipeline(body, {
      context: guard.ctx.executionContext,
      dataSource: guard.ctx.hiringData,
      logMeta: {
        userId: guard.ctx.user.id,
        orgId: guard.ctx.org.id,
        role: guard.ctx.membership.role,
      },
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
