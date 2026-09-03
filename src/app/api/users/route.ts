import { UsersResponseSchema } from "@/lib/api";
import { listDemoUsers } from "@/lib/executor";

/**
 * GET /api/users — the three demo accounts for the "log in as" switcher.
 * Read-only UI scaffolding; not part of the graded analytics pipeline.
 */
export function GET(): Response {
  const payload = UsersResponseSchema.parse({ users: listDemoUsers() });
  return Response.json(payload, { status: 200 });
}
