import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataset } from "@/lib/data/generate";
import { DatasetSchema } from "@/lib/data/schema";

/**
 * Regenerates the committed seed fixtures. Run with `pnpm seed`.
 *
 * The dataset is deterministic (seeded PRNG), so this only needs to run when the
 * generator changes — and re-running it must produce a no-op diff.
 */

const dataset = buildDataset();

// Fail loudly before writing anything if the generator ever drifts out of spec.
DatasetSchema.parse(dataset);

const outDir = join(process.cwd(), "src", "lib", "data", "fixtures");
mkdirSync(outDir, { recursive: true });

const files: ReadonlyArray<readonly [string, unknown]> = [
  ["job-families.json", dataset.jobFamilies],
  ["bands.json", dataset.bands],
  ["employees.json", dataset.employees],
  ["jobs.json", dataset.jobs],
  ["users.json", dataset.users],
];

for (const [name, rows] of files) {
  writeFileSync(join(outDir, name), `${JSON.stringify(rows, null, 2)}\n`);
}

console.log(`Wrote ${files.length} fixture files to src/lib/data/fixtures/`);
