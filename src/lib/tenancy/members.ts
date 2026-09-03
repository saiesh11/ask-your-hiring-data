import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { Role } from "@/lib/db";
import { assertPermission, canAssignRole, isOrgWide } from "@/lib/rbac";

/** The acting caller, distilled from requireContext() — no NextAuth import. */
export interface MemberActor {
  orgId: string;
  userId: string;
  role: Role;
}

export class LastOwnerError extends Error {
  constructor() {
    super("An organization must keep at least one owner");
    this.name = "LastOwnerError";
  }
}
export class MemberNotFoundError extends Error {
  constructor() {
    super("Member not found in this organization");
    this.name = "MemberNotFoundError";
  }
}
export class AlreadyMemberError extends Error {
  constructor(public readonly email: string) {
    super(`${email} is already a member or has a pending invite`);
    this.name = "AlreadyMemberError";
  }
}
export class InvitationInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationInvalidError";
  }
}
export class RoleAssignmentError extends Error {
  constructor(actor: Role, target: Role) {
    super(`A ${actor} cannot assign the ${target} role`);
    this.name = "RoleAssignmentError";
  }
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Scoped roles must be assigned at least one valid job family in the org. */
async function assertScopeValid(
  orgId: string,
  role: Role,
  jobFamilyScope: string[],
): Promise<void> {
  if (isOrgWide(role)) return;
  if (jobFamilyScope.length === 0) {
    throw new InvitationInvalidError(`The ${role} role needs at least one job family assigned`);
  }
  const found = await prisma.jobFamily.count({
    where: { orgId, id: { in: jobFamilyScope } },
  });
  if (found !== new Set(jobFamilyScope).size) {
    throw new InvitationInvalidError("One or more job families are not in this organization");
  }
}

export async function listOrgMembers(actor: MemberActor) {
  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: actor.orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { orgId: actor.orgId, acceptedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      jobFamilyScope: m.jobFamilyScope,
      isSelf: m.userId === actor.userId,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      jobFamilyScope: i.jobFamilyScope,
      expiresAt: i.expiresAt.toISOString(),
      expired: i.expiresAt.getTime() < Date.now(),
    })),
  };
}

export async function inviteMember(
  actor: MemberActor,
  input: { email: string; role: Role; jobFamilyScope?: string[] },
): Promise<{ id: string; token: string }> {
  assertPermission(actor, "members:invite");
  if (!canAssignRole(actor.role, input.role)) {
    throw new RoleAssignmentError(actor.role, input.role);
  }
  const email = input.email.toLowerCase().trim();
  const scope = isOrgWide(input.role) ? [] : (input.jobFamilyScope ?? []);
  await assertScopeValid(actor.orgId, input.role, scope);

  const existingMember = await prisma.membership.findFirst({
    where: { orgId: actor.orgId, user: { email } },
  });
  const existingInvite = await prisma.invitation.findFirst({
    where: { orgId: actor.orgId, email, acceptedAt: null },
  });
  if (existingMember || existingInvite) throw new AlreadyMemberError(email);

  const invite = await prisma.invitation.create({
    data: {
      orgId: actor.orgId,
      email,
      role: input.role,
      jobFamilyScope: scope,
      token: randomUUID(),
      invitedById: actor.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return { id: invite.id, token: invite.token };
}

export async function updateMember(
  actor: MemberActor,
  membershipId: string,
  patch: { role?: Role; jobFamilyScope?: string[] },
): Promise<void> {
  assertPermission(actor, "members:manage_roles");
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: actor.orgId },
  });
  if (!target) throw new MemberNotFoundError();

  const nextRole = patch.role ?? target.role;
  const nextScope = isOrgWide(nextRole) ? [] : (patch.jobFamilyScope ?? target.jobFamilyScope);

  if (patch.role && patch.role !== target.role) {
    if (!canAssignRole(actor.role, patch.role) || !canAssignRole(actor.role, target.role)) {
      throw new RoleAssignmentError(actor.role, patch.role);
    }
    if (target.role === Role.OWNER && patch.role !== Role.OWNER) {
      await assertNotLastOwner(actor.orgId);
    }
  }
  await assertScopeValid(actor.orgId, nextRole, nextScope);

  await prisma.membership.update({
    where: { id: membershipId },
    data: { role: nextRole, jobFamilyScope: nextScope },
  });
}

export async function removeMember(actor: MemberActor, membershipId: string): Promise<void> {
  assertPermission(actor, "members:remove");
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: actor.orgId },
  });
  if (!target) throw new MemberNotFoundError();
  if (target.userId === actor.userId) {
    throw new InvitationInvalidError("You cannot remove yourself");
  }
  if (target.role === Role.OWNER) await assertNotLastOwner(actor.orgId);

  await prisma.membership.delete({ where: { id: membershipId } });
}

export async function revokeInvitation(actor: MemberActor, invitationId: string): Promise<void> {
  assertPermission(actor, "members:invite");
  const invite = await prisma.invitation.findFirst({
    where: { id: invitationId, orgId: actor.orgId, acceptedAt: null },
  });
  if (!invite) throw new MemberNotFoundError();
  await prisma.invitation.delete({ where: { id: invitationId } });
}

export async function lookupInvitation(token: string) {
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { org: { select: { name: true, slug: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) return null;
  return {
    email: invite.email,
    role: invite.role,
    orgName: invite.org.name,
    orgSlug: invite.org.slug,
  };
}

export async function acceptInvitation(
  userId: string,
  token: string,
): Promise<{ orgSlug: string }> {
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { org: { select: { slug: true } } },
  });
  if (!invite || invite.acceptedAt)
    throw new InvitationInvalidError("This invite is no longer valid");
  if (invite.expiresAt.getTime() < Date.now())
    throw new InvitationInvalidError("This invite has expired");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new InvitationInvalidError("This invite was sent to a different email");
  }

  await prisma.$transaction([
    prisma.membership.create({
      data: {
        userId,
        orgId: invite.orgId,
        role: invite.role,
        jobFamilyScope: invite.jobFamilyScope,
      },
    }),
    prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
  return { orgSlug: invite.org.slug };
}

async function assertNotLastOwner(orgId: string): Promise<void> {
  const owners = await prisma.membership.count({ where: { orgId, role: Role.OWNER } });
  if (owners <= 1) throw new LastOwnerError();
}
