import { Role } from "@/lib/db";
import { ORG_WIDE, scopedTo, type ExecutionContext } from "@/lib/executor";
import { DEFAULT_SEED } from "@/lib/hiring-data";

/**
 * TEMPORARY dev shim. Maps the three legacy demo ids to synthetic execution
 * contexts backed by the in-memory generator (DEFAULT_SEED). Replaced in S5 by
 * real Auth.js sessions + a DB membership lookup, at which point the request
 * body stops carrying a user id entirely.
 */

export interface DevPrincipal {
  id: string;
  displayName: string;
  role: Role;
  scopeLabel: string;
  context: ExecutionContext;
  seed: number;
}

const PRINCIPALS: Record<string, DevPrincipal> = {
  chro: {
    id: "chro",
    displayName: "Casey Rivera — CHRO",
    role: Role.CHRO,
    scopeLabel: "Organization-wide",
    context: ORG_WIDE,
    seed: DEFAULT_SEED,
  },
  recruiter_eng: {
    id: "recruiter_eng",
    displayName: "Riley Chen — Recruiter (Engineering)",
    role: Role.RECRUITER,
    scopeLabel: "Engineering",
    context: scopedTo(["Engineering"]),
    seed: DEFAULT_SEED,
  },
  recruiter_sales: {
    id: "recruiter_sales",
    displayName: "Sam Okafor — Recruiter (Sales)",
    role: Role.RECRUITER,
    scopeLabel: "Sales",
    context: scopedTo(["Sales"]),
    seed: DEFAULT_SEED,
  },
};

export class UnknownPrincipalError extends Error {
  constructor(public readonly id: string) {
    super(`Unknown principal: "${id}"`);
    this.name = "UnknownPrincipalError";
  }
}

export function resolveDevPrincipal(id: string): DevPrincipal {
  const principal = PRINCIPALS[id];
  if (!principal) throw new UnknownPrincipalError(id);
  return principal;
}

export function listDevPrincipals(): Array<
  Pick<DevPrincipal, "id" | "displayName" | "role" | "scopeLabel">
> {
  return Object.values(PRINCIPALS).map(({ id, displayName, role, scopeLabel }) => ({
    id,
    displayName,
    role,
    scopeLabel,
  }));
}
