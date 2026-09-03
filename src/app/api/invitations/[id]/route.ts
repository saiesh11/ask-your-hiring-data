import { toErrorResponse } from "@/lib/api";
import { revokeInvitation } from "@/lib/tenancy";
import { guardOrgRoute } from "@/lib/tenancy/route-guard";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    await revokeInvitation(guard.actor, id);
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
