import { buildOrgDataset } from "./generate";
import { OrgHiringDataSchema, type OrgHiringData } from "./schema";

/**
 * Where the executor's data comes from. The executor is data-source agnostic:
 * the pipeline `await source.load()` and passes the plain OrgHiringData in.
 *
 * - InMemoryHiringDataSource — the deterministic generator. Used by tests, the
 *   eval gate, and local dev with no seeded org.
 * - PrismaHiringDataSource (./prisma-source) — one org's rows from Postgres.
 */
export interface HiringDataSource {
  load(): Promise<OrgHiringData>;
}

export class InMemoryHiringDataSource implements HiringDataSource {
  constructor(private readonly seed: number) {}

  load(): Promise<OrgHiringData> {
    return Promise.resolve(OrgHiringDataSchema.parse(buildOrgDataset(this.seed)));
  }
}
