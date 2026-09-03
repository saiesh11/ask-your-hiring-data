import { Role } from "@/lib/db";

/**
 * Role-based access control. Roles come from the Prisma `Role` enum (one source
 * of truth); each maps to an explicit set of permissions. Nothing checks a role
 * name directly — call {@link can} / {@link assertPermission} with a permission.
 */

export const PERMISSIONS = [
  "org:manage", // rename org, edit settings
  "org:delete", // delete the org
  "members:invite",
  "members:manage_roles", // change a member's role or job-family scope
  "members:remove",
  "analytics:query", // use the assistant at all
  "data:read_org_wide", // see every job family (vs. only the member's scope)
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ORG_WIDE: Permission[] = ["analytics:query", "data:read_org_wide"];
const MANAGEMENT: Permission[] = [
  "org:manage",
  "members:invite",
  "members:manage_roles",
  "members:remove",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  [Role.OWNER]: new Set(PERMISSIONS),
  [Role.ADMIN]: new Set<Permission>([...MANAGEMENT, ...ORG_WIDE]),
  [Role.CHRO]: new Set<Permission>(ORG_WIDE),
  // RECRUITER and VIEWER can run the assistant but only within their assigned
  // job-family scope. They are identical for analytics today; the distinct role
  // name reserves intent for future write features.
  [Role.RECRUITER]: new Set<Permission>(["analytics:query"]),
  [Role.VIEWER]: new Set<Permission>(["analytics:query"]),
};

/** Roles whose analytics are NOT constrained to a job-family scope. */
export const ORG_WIDE_ROLES: ReadonlySet<Role> = new Set(
  (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) =>
    ROLE_PERMISSIONS[role].has("data:read_org_wide"),
  ),
);
