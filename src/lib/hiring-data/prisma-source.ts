import { prisma } from "@/lib/db/client";
import type { HiringDataSource } from "./source";
import { OrgHiringDataSchema, type OrgHiringData } from "./schema";

/** A single organization's hiring data, read from Postgres and validated. */
export class PrismaHiringDataSource implements HiringDataSource {
  constructor(private readonly orgId: string) {}

  async load(): Promise<OrgHiringData> {
    const [jobFamilies, bands, employees, jobs] = await Promise.all([
      prisma.jobFamily.findMany({ where: { orgId: this.orgId } }),
      prisma.band.findMany({ where: { orgId: this.orgId }, orderBy: { order: "asc" } }),
      prisma.employee.findMany({ where: { orgId: this.orgId } }),
      prisma.job.findMany({ where: { orgId: this.orgId } }),
    ]);

    return OrgHiringDataSchema.parse({
      jobFamilies: jobFamilies.map((f) => ({ id: f.id, name: f.name })),
      bands: bands.map((b) => ({ id: b.id, name: b.name, order: b.order })),
      employees: employees.map((e) => ({
        id: e.id,
        jobFamilyId: e.jobFamilyId,
        department: e.department,
        bandId: e.bandId,
        hireDate: toISODate(e.hireDate),
        active: e.active,
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        jobFamilyId: j.jobFamilyId,
        bandId: j.bandId,
        postedDate: toISODate(j.postedDate),
        filledDate: j.filledDate ? toISODate(j.filledDate) : null,
        status: j.status,
      })),
    });
  }
}

/** Prisma returns `@db.Date` columns as a Date at UTC midnight. */
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
