import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { createAccount } from "@/lib/tenancy";
import { PrismaHiringDataSource } from "@/lib/hiring-data/prisma-source";
import { buildOrgDataset } from "@/lib/hiring-data";
import { execute, ORG_WIDE } from "@/lib/executor";

/**
 * Integration test — hits the real Postgres. Skipped unless RUN_DB_TESTS=1
 * (so `pnpm test` and CI stay DB-free). Run locally with:
 *   set -a; . ./.env.local; set +a; RUN_DB_TESTS=1 pnpm exec vitest run tests/tenancy.db.test.ts
 */
const RUN = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!RUN)("createAccount (integration)", () => {
  const email = `s5-test-${Date.now()}@example.com`;
  let orgId = "";

  afterAll(async () => {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    await prisma.$disconnect();
  });

  it(
    "creates user + org + OWNER membership + seeded data the executor can query",
    { timeout: 40_000 },
    async () => {
      const result = await createAccount({
        name: "S5 Test",
        email,
        password: "password123",
        orgName: `S5 Test Co ${Date.now()}`,
      });
      orgId = result.orgId;

      const membership = await prisma.membership.findFirst({ where: { orgId } });
      expect(membership?.role).toBe("OWNER");
      expect(membership?.userId).toBe(result.userId);

      expect(await prisma.jobFamily.count({ where: { orgId } })).toBe(5);
      expect(await prisma.band.count({ where: { orgId } })).toBe(4);
      expect(await prisma.employee.count({ where: { orgId } })).toBe(56);
      expect(await prisma.job.count({ where: { orgId } })).toBe(43);

      const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
      const fromDb = execute(
        { version: 1, metric: "headcount", filters: {} },
        ORG_WIDE,
        await new PrismaHiringDataSource(orgId).load(),
      );
      const fromMemory = execute(
        { version: 1, metric: "headcount", filters: {} },
        ORG_WIDE,
        buildOrgDataset(org.dataSeed),
      );
      expect(
        fromDb.ok && fromMemory.ok && fromDb.kind === "scalar" && fromMemory.kind === "scalar",
      ).toBe(true);
      if (fromDb.ok && fromMemory.ok && fromDb.kind === "scalar" && fromMemory.kind === "scalar") {
        expect(fromDb.value).toBe(fromMemory.value);
      }
    },
  );
});
