import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  getRequestContext,
  NoOrganizationError,
  UnauthenticatedError,
} from "@/lib/tenancy/context";

function scopeLabel(scope: readonly string[] | null): string {
  if (scope === null) return "organization-wide";
  return scope.length > 0 ? scope.join(" / ") : "no job families assigned";
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/login");
    if (error instanceof NoOrganizationError) redirect("/signup");
    throw error;
  }

  return (
    <AppShell
      viewer={{
        name: ctx.user.name,
        email: ctx.user.email,
        orgName: ctx.org.name,
        role: ctx.membership.role,
        scopeLabel: scopeLabel(ctx.executionContext.scope),
        canManageMembers: ctx.permissions.includes("members:invite"),
      }}
    >
      {children}
    </AppShell>
  );
}
