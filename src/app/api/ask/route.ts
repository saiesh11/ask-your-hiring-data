import { BadRequestError, runAskPipeline } from "@/lib/api";
import { logger } from "@/lib/observability";

/**
 * POST /api/ask — the one analytics endpoint.
 *
 * `runAskPipeline` owns all request/response Zod validation (so the eval runner,
 * which calls it directly, exercises the identical path). This handler only
 * turns JSON-parse and BadRequestError failures into HTTP status codes.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const response = await runAskPipeline(body);
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
