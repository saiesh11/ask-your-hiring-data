import * as z from "zod";
import { toErrorResponse } from "@/lib/api";
import { auth } from "@/lib/auth";
import { acceptInvitation } from "@/lib/tenancy";

const Body = z.object({ token: z.string().min(1) });

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Missing token." }, { status: 400 });

  try {
    const { orgSlug } = await acceptInvitation(session.user.id, parsed.data.token);
    return Response.json({ ok: true, orgSlug }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
