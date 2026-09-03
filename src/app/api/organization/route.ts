import * as z from "zod";
import { toErrorResponse } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { assertPermission } from "@/lib/rbac";
import { guardOrgRoute } from "@/lib/tenancy/route-guard";

const Body = z.object({ name: z.string().trim().min(1).max(80) });

export async function PATCH(request: Request): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success)
    return Response.json({ error: "Invalid organization name." }, { status: 400 });

  try {
    assertPermission(guard.actor, "org:manage");
    await prisma.organization.update({
      where: { id: guard.actor.orgId },
      data: { name: parsed.data.name },
    });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
