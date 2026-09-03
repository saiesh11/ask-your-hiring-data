import { Role } from "@/lib/db";
import { ORG_WIDE_ROLES, ROLE_PERMISSIONS, type Permission } from "./permissions";

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Minimal shape needed to make an access decision. */
export interface AccessSubject {
  role: Role;
  /** Job-family ids the member may see; only consulted for scoped roles. */
  jobFamilyScope?: string[];
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function assertPermission(subject: AccessSubject, permission: Permission): void {
  if (!can(subject.role, permission)) {
    throw new ForbiddenError(permission);
  }
}

export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/** True when this member sees the whole org (no job-family constraint). */
export function isOrgWide(role: Role): boolean {
  return ORG_WIDE_ROLES.has(role);
}

/**
 * The job-family ids a member's analytics queries are constrained to, or
 * `null` for org-wide access (no constraint).
 */
export function analyticsScope(subject: AccessSubject): string[] | null {
  if (isOrgWide(subject.role)) return null;
  return subject.jobFamilyScope ?? [];
}
