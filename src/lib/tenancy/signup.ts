import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/client";
import { seedOrgHiringData } from "./seed-org";

export class EmailTakenError extends Error {
  constructor(public readonly email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EmailTakenError";
  }
}

export interface CreateAccountInput {
  name: string;
  email: string;
  password: string;
  orgName: string;
}

export interface CreateAccountResult {
  userId: string;
  orgId: string;
  orgSlug: string;
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

/** Deterministic per-org dataset seed derived from the slug (FNV-1a). */
export function seedFromSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000_000;
}

async function uniqueSlug(base: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Sign up: create the user, their first organization, an OWNER membership, and
 * seed that org's synthetic hiring data — all in one transaction.
 */
export async function createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
  const email = input.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new EmailTakenError(email);
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(slugify(input.orgName));
  const dataSeed = seedFromSlug(slug);

  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: { name: input.name.trim(), email, passwordHash },
      });
      const org = await tx.organization.create({
        data: { name: input.orgName.trim(), slug, dataSeed },
      });
      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, role: "OWNER" },
      });
      await seedOrgHiringData(tx, org.id, dataSeed);
      return { userId: user.id, orgId: org.id, orgSlug: slug };
    },
    { timeout: 20_000 },
  );
}
