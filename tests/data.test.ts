import { describe, expect, it } from "vitest";
import {
  dataset,
  demoUsers,
  getJobFamilyByName,
  DatasetSchema,
  REQUIRED_USER_IDS,
} from "@/lib/data";
import { buildDataset, DEFAULT_SEED } from "@/lib/data/generate";

describe("committed fixtures load and validate", () => {
  it("importing the dataset does not throw and matches expected counts", () => {
    expect(dataset.jobFamilies).toHaveLength(5);
    expect(dataset.bands).toHaveLength(4);
    expect(dataset.employees).toHaveLength(56);
    expect(dataset.jobs).toHaveLength(43);
    expect(dataset.users).toHaveLength(3);
  });

  it("bands carry a 1..4 seniority order with Junior lowest and Staff highest", () => {
    const byName = new Map(dataset.bands.map((b) => [b.name, b.order]));
    expect([...byName.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(byName.get("Junior")).toBeLessThan(byName.get("Staff") ?? -1);
  });

  it("every employee and job references a real job family and band", () => {
    const familyIds = new Set(dataset.jobFamilies.map((f) => f.id));
    const bandIds = new Set(dataset.bands.map((b) => b.id));
    for (const e of dataset.employees) {
      expect(familyIds.has(e.jobFamilyId), e.id).toBe(true);
      expect(bandIds.has(e.bandId), e.id).toBe(true);
    }
    for (const j of dataset.jobs) {
      expect(familyIds.has(j.jobFamilyId), j.id).toBe(true);
      expect(bandIds.has(j.bandId), j.id).toBe(true);
    }
  });

  it("filled jobs have a filledDate on/after postedDate; open jobs have none", () => {
    for (const j of dataset.jobs) {
      if (j.status === "filled") {
        expect(j.filledDate, j.id).not.toBeNull();
        expect(j.filledDate! >= j.postedDate, j.id).toBe(true);
      } else {
        expect(j.filledDate, j.id).toBeNull();
      }
    }
  });

  it("the three demo users are exactly as specified", () => {
    expect([...demoUsers.map((u) => u.id)].sort()).toEqual([...REQUIRED_USER_IDS].sort());
    const recruiterEng = demoUsers.find((u) => u.id === "recruiter_eng");
    const recruiterSales = demoUsers.find((u) => u.id === "recruiter_sales");
    const chro = demoUsers.find((u) => u.id === "chro");
    expect(recruiterEng).toMatchObject({ role: "recruiter", jobFamilyId: "jf_engineering" });
    expect(recruiterSales).toMatchObject({ role: "recruiter", jobFamilyId: "jf_sales" });
    expect(chro).toMatchObject({ role: "chro", jobFamilyId: null });
  });

  it("accessors resolve known values and return undefined for unknown ones", () => {
    expect(getJobFamilyByName("Engineering")?.id).toBe("jf_engineering");
    expect(getJobFamilyByName("Legal")).toBeUndefined();
  });
});

describe("generator determinism", () => {
  it("the committed fixtures are exactly what buildDataset() produces (no drift)", () => {
    // If this fails, someone changed the generator without running `pnpm seed`.
    expect(buildDataset()).toEqual({
      jobFamilies: dataset.jobFamilies,
      bands: dataset.bands,
      employees: dataset.employees,
      jobs: dataset.jobs,
      users: dataset.users,
    });
  });

  it("same seed => identical output; different seed => different output", () => {
    expect(buildDataset(DEFAULT_SEED)).toEqual(buildDataset(DEFAULT_SEED));
    expect(buildDataset(1)).not.toEqual(buildDataset(DEFAULT_SEED));
  });
});

describe("DatasetSchema rejects malformed data (fails loudly, never silently)", () => {
  const base = buildDataset();
  const clone = (): ReturnType<typeof buildDataset> => structuredClone(base);

  it("duplicate employee id", () => {
    const d = clone();
    d.employees[1] = { ...d.employees[0]! };
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });

  it("dangling jobFamilyId on a job", () => {
    const d = clone();
    d.jobs[0] = { ...d.jobs[0]!, jobFamilyId: "jf_nope" };
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });

  it("filled job with a null filledDate", () => {
    const d = clone();
    d.jobs[0] = { ...d.jobs[0]!, status: "filled", filledDate: null };
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });

  it("filledDate before postedDate", () => {
    const d = clone();
    d.jobs[0] = {
      ...d.jobs[0]!,
      status: "filled",
      postedDate: "2025-01-01",
      filledDate: "2024-01-01",
    };
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });

  it("only two demo users", () => {
    const d = clone();
    d.users = d.users.slice(0, 2);
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });

  it("recruiter with a null jobFamilyId", () => {
    const d = clone();
    d.users[0] = { ...d.users[0]!, role: "recruiter", jobFamilyId: null };
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });

  it("an unexpected column on an employee", () => {
    const d = clone();
    (d.employees[0] as Record<string, unknown>).salary = 100000;
    expect(DatasetSchema.safeParse(d).success).toBe(false);
  });
});
