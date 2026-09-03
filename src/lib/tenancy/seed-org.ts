import { randomUUID } from "node:crypto";
import type { Prisma } from "@/lib/db";
import { buildOrgDataset } from "@/lib/hiring-data";

type Tx = Prisma.TransactionClient;

function mustGet(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (value === undefined) throw new Error(`seed-org: unresolved reference "${key}"`);
  return value;
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Populates one organization's hiring data from the deterministic generator.
 * Runs inside the signup transaction. Ids for job families / bands are
 * pre-assigned so the whole thing is four `createMany` round-trips. Same `seed`
 * => same rows, so an org's data is reproducible from `Organization.dataSeed`.
 */
export async function seedOrgHiringData(tx: Tx, orgId: string, seed: number): Promise<void> {
  const data = buildOrgDataset(seed);

  const familyId = new Map(data.jobFamilies.map((f) => [f.id, randomUUID()] as const));
  const bandId = new Map(data.bands.map((b) => [b.id, randomUUID()] as const));

  await tx.jobFamily.createMany({
    data: data.jobFamilies.map((f) => ({
      id: mustGet(familyId, f.id),
      orgId,
      name: f.name,
      slug: f.id.replace(/^jf_/, ""),
    })),
  });

  await tx.band.createMany({
    data: data.bands.map((b) => ({
      id: mustGet(bandId, b.id),
      orgId,
      name: b.name,
      order: b.order,
    })),
  });

  await tx.employee.createMany({
    data: data.employees.map((e) => ({
      orgId,
      jobFamilyId: mustGet(familyId, e.jobFamilyId),
      bandId: mustGet(bandId, e.bandId),
      department: e.department,
      hireDate: toDate(e.hireDate),
      active: e.active,
    })),
  });

  await tx.job.createMany({
    data: data.jobs.map((j) => ({
      orgId,
      jobFamilyId: mustGet(familyId, j.jobFamilyId),
      bandId: mustGet(bandId, j.bandId),
      postedDate: toDate(j.postedDate),
      filledDate: j.filledDate ? toDate(j.filledDate) : null,
      status: j.status,
    })),
  });
}
