import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { lookupInvitation } from "@/lib/tenancy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteButton } from "./accept-button";

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await lookupInvitation(token);

  if (invite) {
    const session = await auth();
    if (!session?.user) {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/accept-invite/${token}`)}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{invite ? `Join ${invite.orgName}` : "Invitation unavailable"}</CardTitle>
          <CardDescription>
            {invite ? (
              <>
                Invited as <strong>{invite.role}</strong> ({invite.email}).
              </>
            ) : (
              "This invitation is invalid, already used, or has expired."
            )}
          </CardDescription>
        </CardHeader>
        {invite && (
          <CardContent>
            <AcceptInviteButton token={token} />
          </CardContent>
        )}
      </Card>
    </main>
  );
}
