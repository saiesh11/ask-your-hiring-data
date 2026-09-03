import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppWorkspace } from "@/components/app-workspace";
import {
  getRequestContext,
  NoOrganizationError,
  UnauthenticatedError,
} from "@/lib/tenancy/context";

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
    <AppWorkspace
      viewer={{
        name: ctx.user.name,
        email: ctx.user.email,
        orgName: ctx.org.name,
        role: ctx.membership.role,
      }}
    >
      {children}
    </AppWorkspace>
  );
}
