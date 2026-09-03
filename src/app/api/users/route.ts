import { listDevPrincipals, UsersResponseSchema } from "@/lib/api";

/**
 * GET /api/users — the demo principals for the dev "view as" switcher.
 * TODO(S5): replaced by real auth (session + org memberships).
 */
export function GET(): Response {
  const payload = UsersResponseSchema.parse({
    users: listDevPrincipals().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      role: p.role,
      scope: p.scopeLabel,
    })),
  });
  return Response.json(payload, { status: 200 });
}
