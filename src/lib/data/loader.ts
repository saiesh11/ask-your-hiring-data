import bandsRaw from "./fixtures/bands.json";
import employeesRaw from "./fixtures/employees.json";
import jobFamiliesRaw from "./fixtures/job-families.json";
import jobsRaw from "./fixtures/jobs.json";
import usersRaw from "./fixtures/users.json";
import {
  DatasetSchema,
  type Band,
  type Dataset,
  type DemoUser,
  type Employee,
  type Job,
  type JobFamily,
} from "./schema";

/**
 * Loads and validates the committed seed fixtures at import time. A malformed
 * fixture throws here — a hard startup failure by design — so it can never reach
 * the executor silently.
 */
function loadDataset(): Dataset {
  const parsed = DatasetSchema.safeParse({
    jobFamilies: jobFamiliesRaw,
    bands: bandsRaw,
    employees: employeesRaw,
    jobs: jobsRaw,
    users: usersRaw,
  });
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(`Invalid seed fixtures — refusing to start:\n${detail}`);
  }
  return parsed.data;
}

export const dataset: Dataset = loadDataset();

export const jobFamilies: readonly JobFamily[] = dataset.jobFamilies;
export const bands: readonly Band[] = dataset.bands;
export const employees: readonly Employee[] = dataset.employees;
export const jobs: readonly Job[] = dataset.jobs;
export const demoUsers: readonly DemoUser[] = dataset.users;

const familyById = new Map<string, JobFamily>(
  dataset.jobFamilies.map((family) => [family.id, family]),
);
const familyByName = new Map<string, JobFamily>(
  dataset.jobFamilies.map((family) => [family.name, family]),
);
const bandById = new Map<string, Band>(dataset.bands.map((band) => [band.id, band]));
const userById = new Map<string, DemoUser>(dataset.users.map((user) => [user.id, user]));

export function getJobFamilyById(id: string): JobFamily | undefined {
  return familyById.get(id);
}

export function getJobFamilyByName(name: string): JobFamily | undefined {
  return familyByName.get(name);
}

export function getBandById(id: string): Band | undefined {
  return bandById.get(id);
}

export function getDemoUserById(id: string): DemoUser | undefined {
  return userById.get(id);
}
