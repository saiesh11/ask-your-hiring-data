import * as z from "zod";
import { BANDS, JOB_FAMILIES } from "@/lib/query-ir";

/**
 * Zod schemas for the seed fixtures. The loader validates the assembled dataset
 * against {@link DatasetSchema} at import time and throws if anything is off, so
 * a malformed fixture can never reach the executor silently.
 *
 * `.strictObject` everywhere: an unexpected column in a fixture is a bug, not
 * something to ignore.
 */

const isoDate = z.iso.date();
const id = z.string().min(1);

export const JobFamilySchema = z.strictObject({
  id,
  name: z.enum(JOB_FAMILIES),
});

export const BandSchema = z.strictObject({
  id,
  name: z.enum(BANDS),
  // Explicit seniority order: Junior=1 … Staff=4.
  order: z.number().int().min(1).max(BANDS.length),
});

export const EmployeeSchema = z.strictObject({
  id,
  jobFamilyId: id,
  department: z.string().min(1),
  bandId: id,
  hireDate: isoDate,
  active: z.boolean(),
});

export const JobSchema = z
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

export const DemoUserSchema = z
  .strictObject({
    id,
    displayName: z.string().min(1),
    role: z.enum(["recruiter", "chro"]),
    // Non-null for recruiters (their scope), null for the org-wide CHRO.
    jobFamilyId: id.nullable(),
  })
  .refine((user) => (user.role === "recruiter") === (user.jobFamilyId !== null), {
    error: "a recruiter must have a jobFamilyId; the CHRO must not",
  });

/** The three demo accounts, deliberately chosen to make role-scoping testable. */
export const REQUIRED_USER_IDS = ["recruiter_eng", "recruiter_sales", "chro"] as const;

export const DatasetSchema = z
  .strictObject({
    jobFamilies: z.array(JobFamilySchema).min(1),
    bands: z.array(BandSchema).min(1),
    employees: z.array(EmployeeSchema).min(1),
    jobs: z.array(JobSchema).min(1),
    users: z.array(DemoUserSchema).length(REQUIRED_USER_IDS.length),
  })
  .superRefine((data, ctx) => {
    const familyIds = new Set(data.jobFamilies.map((f) => f.id));
    const bandIds = new Set(data.bands.map((b) => b.id));

    // Unique ids within every collection.
    const collections = [
      ["jobFamilies", data.jobFamilies],
      ["bands", data.bands],
      ["employees", data.employees],
      ["jobs", data.jobs],
      ["users", data.users],
    ] as const;
    for (const [name, rows] of collections) {
      const seen = new Set<string>();
      for (const row of rows) {
        if (seen.has(row.id)) {
          ctx.addIssue({ code: "custom", message: `${name}: duplicate id "${row.id}"` });
        }
        seen.add(row.id);
      }
    }

    // The closed vocabularies must all be present (order-independent).
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

    // band.order is a 1..N permutation.
    const orders = [...data.bands.map((b) => b.order)].sort((a, b) => a - b);
    const expectedOrders = data.bands.map((_, i) => i + 1);
    if (orders.join(",") !== expectedOrders.join(",")) {
      ctx.addIssue({
        code: "custom",
        message: `bands.order must be a 1..${data.bands.length} permutation`,
      });
    }

    // Referential integrity.
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
    data.users.forEach((u, i) => {
      if (u.jobFamilyId !== null && !familyIds.has(u.jobFamilyId)) {
        ctx.addIssue({
          code: "custom",
          path: ["users", i, "jobFamilyId"],
          message: `unknown jobFamilyId "${u.jobFamilyId}"`,
        });
      }
    });

    // Exactly the three required demo accounts.
    const gotUserIds = [...data.users.map((u) => u.id)].sort();
    const wantUserIds = [...REQUIRED_USER_IDS].sort();
    if (gotUserIds.join(",") !== wantUserIds.join(",")) {
      ctx.addIssue({
        code: "custom",
        message: `users must be exactly: ${REQUIRED_USER_IDS.join(", ")}`,
      });
    }
  });

export type JobFamily = z.infer<typeof JobFamilySchema>;
export type Band = z.infer<typeof BandSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type Job = z.infer<typeof JobSchema>;
export type DemoUser = z.infer<typeof DemoUserSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;
