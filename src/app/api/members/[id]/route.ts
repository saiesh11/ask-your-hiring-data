import * as z from "zod";
import { toErrorResponse } from "@/lib/api";
import { Role } from "@/lib/db";
import { removeMember, updateMember } from "@/lib/tenancy";
import { guardOrgRoute } from "@/lib/tenancy/route-guard";

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  role: z.enum(Role).optional(),
  jobFamilyScope: z.array(z.string().min(1)).optional(),
});

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid update." }, { status: 400 });
  }

  try {
    await updateMember(guard.actor, id, parsed.data);
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    await removeMember(guard.actor, id);
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
