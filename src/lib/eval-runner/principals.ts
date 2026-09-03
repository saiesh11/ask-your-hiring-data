import { Role } from "@/lib/db";
import { ORG_WIDE, scopedTo, type ExecutionContext } from "@/lib/executor";
import { DEFAULT_SEED } from "@/lib/hiring-data";

/**
 * Synthetic principals for the eval suite. They stand in for real org
 * memberships so the eval gate can exercise org-wide vs job-family-scoped
 * access deterministically, with no database. The `userId` field in
 * eval-set.json refers to one of these.
 */

export interface DevPrincipal {
  id: string;
  role: Role;
  context: ExecutionContext;
  seed: number;
}

const PRINCIPALS: Record<string, DevPrincipal> = {
  chro: { id: "chro", role: Role.CHRO, context: ORG_WIDE, seed: DEFAULT_SEED },
  recruiter_eng: {
    id: "recruiter_eng",
    role: Role.RECRUITER,
    context: scopedTo(["Engineering"]),
    seed: DEFAULT_SEED,
  },
  recruiter_sales: {
    id: "recruiter_sales",
    role: Role.RECRUITER,
    context: scopedTo(["Sales"]),
    seed: DEFAULT_SEED,
  },
};

export function resolveDevPrincipal(id: string): DevPrincipal {
  const principal = PRINCIPALS[id];
  if (!principal) throw new Error(`Unknown eval principal: "${id}"`);
  return principal;
}
