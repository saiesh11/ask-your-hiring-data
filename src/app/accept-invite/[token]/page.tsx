import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { lookupInvitation } from "@/lib/tenancy";
import { AcceptInviteButton } from "./accept-button";

const wrap = { maxWidth: 440, margin: "5rem auto", padding: "0 1.25rem" } as const;

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await lookupInvitation(token);

  if (!invite) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: "1.2rem" }}>Invitation unavailable</h1>
        <p style={{ color: "var(--dim)" }}>This invitation is invalid, already used, or expired.</p>
      </main>
    );
  }

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/accept-invite/${token}`)}`);
  }

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: "1.2rem" }}>Join {invite.orgName}</h1>
      <p style={{ color: "var(--dim)" }}>
        You&apos;ve been invited to <strong>{invite.orgName}</strong> as{" "}
        <strong>{invite.role}</strong> ({invite.email}).
      </p>
      <AcceptInviteButton token={token} />
    </main>
  );
}
