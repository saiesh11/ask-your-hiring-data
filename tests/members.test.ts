import { describe, expect, it } from "vitest";
import { Role } from "@/lib/db";
import { canAssignRole, ForbiddenError } from "@/lib/rbac";
import { inviteMember, RoleAssignmentError, type MemberActor } from "@/lib/tenancy";

describe("canAssignRole", () => {
  it("an actor can assign roles at or below their own rank", () => {
    expect(canAssignRole(Role.OWNER, Role.OWNER)).toBe(true);
    expect(canAssignRole(Role.OWNER, Role.ADMIN)).toBe(true);
    expect(canAssignRole(Role.ADMIN, Role.OWNER)).toBe(false);
    expect(canAssignRole(Role.ADMIN, Role.ADMIN)).toBe(true);
    expect(canAssignRole(Role.ADMIN, Role.CHRO)).toBe(true);
    expect(canAssignRole(Role.CHRO, Role.ADMIN)).toBe(false);
    expect(canAssignRole(Role.RECRUITER, Role.VIEWER)).toBe(true);
  });
});

describe("inviteMember — permission guards (before any DB call)", () => {
  const recruiter: MemberActor = { orgId: "o1", userId: "u1", role: Role.RECRUITER };
  const admin: MemberActor = { orgId: "o1", userId: "u1", role: Role.ADMIN };

  it("rejects a caller without members:invite", async () => {
    await expect(
      inviteMember(recruiter, {
        email: "x@example.com",
        role: Role.VIEWER,
        jobFamilyScope: ["jf"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects an ADMIN trying to grant OWNER", async () => {
    await expect(
      inviteMember(admin, { email: "x@example.com", role: Role.OWNER }),
    ).rejects.toBeInstanceOf(RoleAssignmentError);
  });
});
