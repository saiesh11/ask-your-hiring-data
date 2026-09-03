import { BANDS, JOB_FAMILIES } from "@/lib/query-ir";
import { addDays, Rng } from "./prng";
import type { BandRow, EmployeeRow, JobRow, JobFamilyRow, OrgHiringData } from "./schema";

/**
 * Deterministic synthetic hiring data for ONE organization. Same `seed` always
 * produces the same records — used both to seed a new org's rows on signup and,
 * directly (via InMemoryHiringDataSource), by the tests and the eval gate.
 */

// Seed for the demo org and the eval suite. Chosen by scanning seeds for
// balanced coverage: every job family gets enough employees, open reqs, and
// filled jobs to exercise scoping on non-zero numbers.
export const DEFAULT_SEED = 42;

const EMPLOYEE_COUNT = 56;
const JOB_COUNT = 43;

/** "As of" date — nothing is hired or filled after this. */
const AS_OF = "2025-06-30";
const HIRE_FROM = "2019-01-02";
const POSTED_FROM = "2024-01-02";
const POSTED_TO = "2025-06-15";

const ACTIVE_PROBABILITY = 0.82;
const FILLED_PROBABILITY = 0.6;
const MIN_DAYS_TO_FILL = 7;
const MAX_DAYS_TO_FILL = 120;

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

export function buildOrgDataset(seed: number = DEFAULT_SEED): OrgHiringData {
  const rng = new Rng(seed);

  const jobFamilies: JobFamilyRow[] = JOB_FAMILIES.map((name) => ({
    id: `jf_${slug(name)}`,
    name,
  }));

  const bands: BandRow[] = BANDS.map((name, index) => ({
    id: `band_${slug(name)}`,
    name,
    order: index + 1,
  }));

  const employees: EmployeeRow[] = [];
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

  const jobs: JobRow[] = [];
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

  return { jobFamilies, bands, employees, jobs };
}
