import { BANDS, JOB_FAMILIES } from "@/lib/query-ir";
import { addDays, Rng } from "./prng";
import type { Band, Dataset, DemoUser, Employee, Job, JobFamily } from "./schema";

/**
 * Deterministic synthetic dataset. `buildDataset()` with no argument always
 * produces the exact same records; `pnpm seed` writes them to
 * `src/lib/data/fixtures/*.json`, which are committed and are the world the
 * executor and eval suite run against.
 */

// Chosen by scanning seeds for balanced coverage: every job family ends up with
// enough employees, open reqs, and filled jobs for the eval suite to exercise
// role scoping on real (non-zero) numbers for both recruiter scopes.
export const DEFAULT_SEED = 42;

const EMPLOYEE_COUNT = 56;
const JOB_COUNT = 43;

/** Dataset "as of" date — nothing is hired or filled after this. */
const AS_OF = "2025-06-30";
const HIRE_FROM = "2019-01-02";
const POSTED_FROM = "2024-01-02";
const POSTED_TO = "2025-06-15";

const ACTIVE_PROBABILITY = 0.82;
const FILLED_PROBABILITY = 0.6;
const MIN_DAYS_TO_FILL = 7;
const MAX_DAYS_TO_FILL = 120;

// A couple of departments per family — descriptive only (not an IR filter).
const DEPARTMENTS = {
  Engineering: ["Platform", "Product Engineering", "Infrastructure"],
  Sales: ["Enterprise", "Mid-Market", "Sales Development"],
  Product: ["Core Product", "Growth"],
  Design: ["Product Design", "Brand & Marketing Design"],
  Marketing: ["Demand Generation", "Content", "Lifecycle"],
} satisfies Record<(typeof JOB_FAMILIES)[number], readonly string[]>;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function buildDataset(seed: number = DEFAULT_SEED): Dataset {
  const rng = new Rng(seed);

  const jobFamilies: JobFamily[] = JOB_FAMILIES.map((name) => ({
    id: `jf_${slug(name)}`,
    name,
  }));

  const bands: Band[] = BANDS.map((name, index) => ({
    id: `band_${slug(name)}`,
    name,
    order: index + 1,
  }));

  const employees: Employee[] = [];
  for (let i = 1; i <= EMPLOYEE_COUNT; i += 1) {
    const family = rng.pick(jobFamilies);
    const band = rng.pick(bands);
    employees.push({
      id: `emp_${String(i).padStart(4, "0")}`,
      jobFamilyId: family.id,
      department: rng.pick(DEPARTMENTS[family.name]),
      bandId: band.id,
      hireDate: rng.dateBetween(HIRE_FROM, AS_OF),
      active: rng.chance(ACTIVE_PROBABILITY),
    });
  }

  const jobs: Job[] = [];
  for (let i = 1; i <= JOB_COUNT; i += 1) {
    const family = rng.pick(jobFamilies);
    const band = rng.pick(bands);
    const postedDate = rng.dateBetween(POSTED_FROM, POSTED_TO);
    const isFilled = rng.chance(FILLED_PROBABILITY);
    let filledDate: string | null = null;
    if (isFilled) {
      const candidate = addDays(postedDate, rng.int(MIN_DAYS_TO_FILL, MAX_DAYS_TO_FILL));
      filledDate = candidate > AS_OF ? AS_OF : candidate;
    }
    jobs.push({
      id: `job_${String(i).padStart(4, "0")}`,
      jobFamilyId: family.id,
      bandId: band.id,
      postedDate,
      filledDate,
      status: isFilled ? "filled" : "open",
    });
  }

  // The three demo accounts are fixed, not random: two recruiters (Engineering
  // and Sales) so the eval suite can prove a recruiter is denied a *peer's*
  // data, plus one org-wide CHRO.
  const users: DemoUser[] = [
    {
      id: "recruiter_eng",
      displayName: "Riley Chen — Recruiter (Engineering)",
      role: "recruiter",
      jobFamilyId: "jf_engineering",
    },
    {
      id: "recruiter_sales",
      displayName: "Sam Okafor — Recruiter (Sales)",
      role: "recruiter",
      jobFamilyId: "jf_sales",
    },
    {
      id: "chro",
      displayName: "Casey Rivera — CHRO",
      role: "chro",
      jobFamilyId: null,
    },
  ];

  return { jobFamilies, bands, employees, jobs, users };
}
