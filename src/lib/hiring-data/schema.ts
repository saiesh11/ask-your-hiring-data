import * as z from "zod";
import { BANDS, JOB_FAMILIES } from "@/lib/query-ir";

/**
 * The shape the executor computes over: one organization's hiring data with
 * ISO date strings. Both data sources (in-memory generator, Prisma) validate
 * their output against {@link OrgHiringDataSchema} so a malformed dataset fails
 * loudly instead of reaching the executor.
 */

const isoDate = z.iso.date();
const id = z.string().min(1);

export const JobFamilyRowSchema = z.strictObject({
  id,
  name: z.enum(JOB_FAMILIES),
});

export const BandRowSchema = z.strictObject({
  id,
  name: z.enum(BANDS),
  order: z.number().int().min(1).max(BANDS.length),
});

export const EmployeeRowSchema = z.strictObject({
  id,
  jobFamilyId: id,
  department: z.string().min(1),
  bandId: id,
  hireDate: isoDate,
  active: z.boolean(),
});

export const JobRowSchema = z
  .strictObject({
    id,
    jobFamilyId: id,
    bandId: id,
    postedDate: isoDate,
    filledDate: isoDate.nullable(),
    status: z.enum(["open", "filled"]),
  })
  .refine((job) => (job.status === "filled") === (job.filledDate !== null), {
    error: "job.status is 'filled' iff filledDate is set",
  })
  .refine((job) => job.filledDate === null || job.filledDate >= job.postedDate, {
    error: "job.filledDate must be on or after job.postedDate",
  });

export const OrgHiringDataSchema = z
  .strictObject({
    jobFamilies: z.array(JobFamilyRowSchema).min(1),
    bands: z.array(BandRowSchema).min(1),
    employees: z.array(EmployeeRowSchema),
    jobs: z.array(JobRowSchema),
  })
  .superRefine((data, ctx) => {
    const familyIds = new Set(data.jobFamilies.map((f) => f.id));
    const bandIds = new Set(data.bands.map((b) => b.id));

    for (const [name, rows] of [
      ["jobFamilies", data.jobFamilies],
      ["bands", data.bands],
      ["employees", data.employees],
      ["jobs", data.jobs],
    ] as const) {
      const seen = new Set<string>();
      for (const row of rows) {
        if (seen.has(row.id)) {
          ctx.addIssue({ code: "custom", message: `${name}: duplicate id "${row.id}"` });
        }
        seen.add(row.id);
      }
    }

    const familyNames = new Set(data.jobFamilies.map((f) => f.name));
    for (const expected of JOB_FAMILIES) {
      if (!familyNames.has(expected)) {
        ctx.addIssue({ code: "custom", message: `jobFamilies is missing "${expected}"` });
      }
    }
    const bandNames = new Set(data.bands.map((b) => b.name));
    for (const expected of BANDS) {
      if (!bandNames.has(expected)) {
        ctx.addIssue({ code: "custom", message: `bands is missing "${expected}"` });
      }
    }

    const orders = [...data.bands.map((b) => b.order)].sort((a, b) => a - b);
    if (orders.join(",") !== data.bands.map((_, i) => i + 1).join(",")) {
      ctx.addIssue({
        code: "custom",
        message: `bands.order must be a 1..${data.bands.length} permutation`,
      });
    }

    data.employees.forEach((e, i) => {
      if (!familyIds.has(e.jobFamilyId)) {
        ctx.addIssue({
          code: "custom",
          path: ["employees", i, "jobFamilyId"],
          message: `unknown jobFamilyId "${e.jobFamilyId}"`,
        });
      }
      if (!bandIds.has(e.bandId)) {
        ctx.addIssue({
          code: "custom",
          path: ["employees", i, "bandId"],
          message: `unknown bandId "${e.bandId}"`,
        });
      }
    });
    data.jobs.forEach((j, i) => {
      if (!familyIds.has(j.jobFamilyId)) {
        ctx.addIssue({
          code: "custom",
          path: ["jobs", i, "jobFamilyId"],
          message: `unknown jobFamilyId "${j.jobFamilyId}"`,
        });
      }
      if (!bandIds.has(j.bandId)) {
        ctx.addIssue({
          code: "custom",
          path: ["jobs", i, "bandId"],
          message: `unknown bandId "${j.bandId}"`,
        });
      }
    });
  });

export type JobFamilyRow = z.infer<typeof JobFamilyRowSchema>;
export type BandRow = z.infer<typeof BandRowSchema>;
export type EmployeeRow = z.infer<typeof EmployeeRowSchema>;
export type JobRow = z.infer<typeof JobRowSchema>;
export type OrgHiringData = z.infer<typeof OrgHiringDataSchema>;
