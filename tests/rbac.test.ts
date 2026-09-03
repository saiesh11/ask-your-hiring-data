import { describe, expect, it } from "vitest";
import { Role } from "@/lib/db";
import {
  analyticsScope,
  assertPermission,
  can,
  ForbiddenError,
  isOrgWide,
  permissionsFor,
  PERMISSIONS,
  type Permission,
} from "@/lib/rbac";

// The full spec, written out so a change to ROLE_PERMISSIONS must be deliberate.
const EXPECTED: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    "org:manage",
    "org:delete",
    "members:invite",
    "members:manage_roles",
    "members:remove",
    "analytics:query",
    "data:read_org_wide",
  ],
  [Role.ADMIN]: [
    "org:manage",
    "members:invite",
    "members:manage_roles",
    "members:remove",
    "analytics:query",
    "data:read_org_wide",
  ],
  [Role.CHRO]: ["analytics:query", "data:read_org_wide"],
  [Role.RECRUITER]: ["analytics:query"],
  [Role.VIEWER]: ["analytics:query"],
};

describe("rbac — role × permission matrix", () => {
  for (const role of Object.values(Role)) {
    it(`${role} grants exactly its documented permissions`, () => {
      const granted = EXPECTED[role];
      for (const permission of PERMISSIONS) {
        expect(can(role, permission), `${role} / ${permission}`).toBe(granted.includes(permission));
      }
      expect([...permissionsFor(role)].sort()).toEqual([...granted].sort());
    });
  }

  it("only OWNER can delete the org", () => {
    expect(can(Role.OWNER, "org:delete")).toBe(true);
    for (const role of [Role.ADMIN, Role.CHRO, Role.RECRUITER, Role.VIEWER]) {
      expect(can(role, "org:delete"), role).toBe(false);
    }
  });

  it("every role can run the assistant", () => {
    for (const role of Object.values(Role)) {
      expect(can(role, "analytics:query"), role).toBe(true);
    }
  });
});

describe("rbac — assertPermission", () => {
  it("passes silently when allowed", () => {
    expect(() => assertPermission({ role: Role.ADMIN }, "members:invite")).not.toThrow();
  });

  it("throws ForbiddenError carrying the permission when denied", () => {
    try {
      assertPermission({ role: Role.RECRUITER }, "members:invite");
      throw new Error("expected assertPermission to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).permission).toBe("members:invite");
    }
  });
});

describe("rbac — analytics scoping", () => {
  it("org-wide roles are unconstrained (scope null)", () => {
    for (const role of [Role.OWNER, Role.ADMIN, Role.CHRO]) {
      expect(isOrgWide(role), role).toBe(true);
      expect(analyticsScope({ role, jobFamilyScope: ["x"] }), role).toBeNull();
    }
  });

  it("scoped roles are constrained to their job-family list", () => {
    for (const role of [Role.RECRUITER, Role.VIEWER]) {
      expect(isOrgWide(role), role).toBe(false);
      expect(analyticsScope({ role, jobFamilyScope: ["jf_1", "jf_2"] })).toEqual(["jf_1", "jf_2"]);
      expect(analyticsScope({ role })).toEqual([]);
    }
  });
});
