import * as z from "zod";
import { toErrorResponse } from "@/lib/api";
import { Role } from "@/lib/db";
import { inviteMember, listOrgMembers } from "@/lib/tenancy";
import { guardOrgRoute } from "@/lib/tenancy/route-guard";

export async function GET(): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;
  try {
    return Response.json(await listOrgMembers(guard.actor), { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const InviteBody = z.object({
  email: z.email(),
  role: z.enum(Role),
  jobFamilyScope: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const guard = await guardOrgRoute();
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = InviteBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid invitation.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  try {
    const { id, token } = await inviteMember(guard.actor, parsed.data);
    return Response.json({ id, token, acceptUrl: `/accept-invite/${token}` }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
