import { computeDashboard } from "@/lib/dashboard";
import { logger } from "@/lib/observability";
import { guardOrgRoute } from "@/lib/tenancy/route-guard";

/**
 * GET /api/dashboard — the curated Dashboard payload for the caller's org,
 * confined to their job-family scope. No request body, no LLM.
 */
export async function GET(): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;

  try {
    const data = await guard.ctx.hiringData.load();
    const dashboard = computeDashboard(data, guard.ctx.executionContext);
    return Response.json(dashboard, { status: 200 });
  } catch (error) {
    logger.error("api_dashboard_unhandled", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal error." }, { status: 500 });
  }
}
