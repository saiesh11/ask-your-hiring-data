import { prisma } from "@/lib/db/client";
import { listOrgMembers } from "@/lib/tenancy";
import { getRequestContext } from "@/lib/tenancy/context";
import { MembersPanel } from "@/components/members-panel";

export default async function MembersPage() {
  const ctx = await getRequestContext();
  const actor = { orgId: ctx.org.id, userId: ctx.user.id, role: ctx.membership.role };
  const [data, jobFamilies] = await Promise.all([
    listOrgMembers(actor),
    prisma.jobFamily.findMany({
      where: { orgId: ctx.org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <MembersPanel
      initialMembers={data.members}
      initialInvitations={data.invitations}
      jobFamilies={jobFamilies}
      canManage={ctx.permissions.includes("members:invite")}
      canManageRoles={ctx.permissions.includes("members:manage_roles")}
      canRemove={ctx.permissions.includes("members:remove")}
    />
  );
}
