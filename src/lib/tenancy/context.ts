import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import type { Role } from "@/lib/db";
import { ORG_WIDE, scopedTo, type ExecutionContext } from "@/lib/executor";
import { HiringDataSource } from "@/lib/hiring-data";
import { PrismaHiringDataSource } from "@/lib/hiring-data/prisma-source";
import type { JobFamily } from "@/lib/query-ir";
import { analyticsScope, isOrgWide, permissionsFor, type Permission } from "@/lib/rbac";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

export class NoOrganizationError extends Error {
  constructor(public readonly userId: string) {
    super(`User ${userId} has no organization membership`);
    this.name = "NoOrganizationError";
  }
}

export interface RequestContext {
  user: { id: string; name: string; email: string };
  org: { id: string; name: string; slug: string; dataSeed: number };
  membership: { role: Role; jobFamilyScope: string[] };
  permissions: Permission[];
  /** For the analytics executor. */
  executionContext: ExecutionContext;
  /** Hiring data bound to the active org. */
  hiringData: HiringDataSource;
}

/**
 * Resolves the signed-in caller into everything a request needs: their user,
 * their active organization, their membership + permissions, the analytics
 * execution context (org-wide vs job-family-scoped), and an org-bound data
 * source. This is the single server-side entry point — role and scope are read
 * from the DB membership, never from the request body or the LLM.
 */
export async function requireContext(opts: { orgSlug?: string } = {}): Promise<RequestContext> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { org: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const membership =
    (opts.orgSlug
      ? user?.memberships.find((m) => m.org.slug === opts.orgSlug)
      : user?.memberships[0]) ?? undefined;
  if (!user || !membership) {
    throw new NoOrganizationError(userId);
  }
  const org = membership.org;

  let executionContext: ExecutionContext = ORG_WIDE;
  if (!isOrgWide(membership.role)) {
    const scopeIds =
      analyticsScope({ role: membership.role, jobFamilyScope: membership.jobFamilyScope }) ?? [];
    const families =
      scopeIds.length === 0
        ? []
        : (
            await prisma.jobFamily.findMany({
              where: { orgId: org.id, id: { in: scopeIds } },
              select: { name: true },
            })
          ).map((f) => f.name as JobFamily);
    executionContext = scopedTo(families);
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    org: { id: org.id, name: org.name, slug: org.slug, dataSeed: org.dataSeed },
    membership: { role: membership.role, jobFamilyScope: membership.jobFamilyScope },
    permissions: permissionsFor(membership.role),
    executionContext,
    hiringData: new PrismaHiringDataSource(org.id),
  };
}

/** Request-deduped requireContext — a layout and its page share one lookup. */
export const getRequestContext = cache((): Promise<RequestContext> => requireContext());
