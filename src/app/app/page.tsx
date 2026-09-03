import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { NoOrganizationError, requireContext } from "@/lib/tenancy/context";

export default async function AppPage() {
  let ctx;
  try {
    ctx = await requireContext();
  } catch (error) {
    // UnauthenticatedError is already handled by the layout guard.
    if (error instanceof NoOrganizationError) redirect("/signup");
    throw error;
  }

  const scope = ctx.executionContext.scope;
  const scopeLabel =
    scope === null
      ? "organization-wide"
      : scope.length > 0
        ? scope.join(" / ")
        : "no job families assigned";

  return (
    <Chat
      me={{
        name: ctx.user.name,
        orgName: ctx.org.name,
        role: ctx.membership.role,
        scopeLabel,
      }}
    />
  );
}
