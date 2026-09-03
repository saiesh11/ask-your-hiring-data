import * as z from "zod";
import { logger } from "@/lib/observability";
import { createAccount, EmailTakenError } from "@/lib/tenancy";

const SignupBody = z.strictObject({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(200),
  orgName: z.string().trim().min(1).max(80),
});

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = SignupBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid signup details.",
        issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  try {
    const { orgSlug } = await createAccount(parsed.data);
    return Response.json({ ok: true, orgSlug }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return Response.json({ error: "That email is already registered." }, { status: 409 });
    }
    logger.error("signup_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Could not create the account." }, { status: 500 });
  }
}
