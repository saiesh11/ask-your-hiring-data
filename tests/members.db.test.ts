import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { Role } from "@/lib/db";
import { createAccount } from "@/lib/tenancy/signup";
import {
  acceptInvitation,
  inviteMember,
  LastOwnerError,
  listOrgMembers,
  removeMember,
  updateMember,
  type MemberActor,
} from "@/lib/tenancy/members";
import { hashPassword } from "@/lib/auth/password";

/**
 * Integration — hits Postgres. Skipped unless RUN_DB_TESTS=1. Run with:
 *   set -a; . ./.env.local; set +a; RUN_DB_TESTS=1 pnpm exec vitest run tests/members.db.test.ts
 */
const RUN = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!RUN)("members lifecycle (integration)", () => {
  const stamp = Date.now();
  const ownerEmail = `s8-owner-${stamp}@example.com`;
  const inviteeEmail = `s8-recruiter-${stamp}@example.com`;
  let orgId = "";
  let ownerUserId = "";

  afterAll(async () => {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user
      .deleteMany({ where: { email: { in: [ownerEmail, inviteeEmail] } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  it(
    "invite -> accept -> list -> update -> remove, with last-owner protection",
    { timeout: 40_000 },
    async () => {
      const { orgId: createdOrg, userId } = await createAccount({
        name: "S8 Owner",
        email: ownerEmail,
        password: "password123",
        orgName: `S8 Co ${stamp}`,
      });
      orgId = createdOrg;
      ownerUserId = userId;
      const owner: MemberActor = { orgId, userId: ownerUserId, role: Role.OWNER };

      const engFamily = await prisma.jobFamily.findFirstOrThrow({
        where: { orgId, name: "Engineering" },
      });

      // invitee needs a user account (as if they signed up)
      const invitee = await prisma.user.create({
        data: {
          name: "S8 Recruiter",
          email: inviteeEmail,
          passwordHash: await hashPassword("password123"),
        },
      });

      const { token } = await inviteMember(owner, {
        email: inviteeEmail,
        role: Role.RECRUITER,
        jobFamilyScope: [engFamily.id],
      });

      const { orgSlug } = await acceptInvitation(invitee.id, token);
      expect(orgSlug).toBeTruthy();

      let listed = await listOrgMembers(owner);
      expect(listed.members).toHaveLength(2);
      const rec = listed.members.find((m) => m.email === inviteeEmail);
      expect(rec?.role).toBe("RECRUITER");
      expect(rec?.jobFamilyScope).toEqual([engFamily.id]);

      // owner cannot be demoted while sole owner
      const ownerMembership = listed.members.find((m) => m.userId === ownerUserId);
      await expect(
        updateMember(owner, ownerMembership!.id, { role: Role.CHRO }),
      ).rejects.toBeInstanceOf(LastOwnerError);

      // promote the recruiter to CHRO (org-wide -> scope cleared)
      await updateMember(owner, rec!.id, { role: Role.CHRO });
      listed = await listOrgMembers(owner);
      const promoted = listed.members.find((m) => m.email === inviteeEmail);
      expect(promoted?.role).toBe("CHRO");
      expect(promoted?.jobFamilyScope).toEqual([]);

      // remove them
      await removeMember(owner, promoted!.id);
      listed = await listOrgMembers(owner);
      expect(listed.members).toHaveLength(1);
    },
  );
});
