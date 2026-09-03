import { runEvalSuite } from "./run";

/**
 * `pnpm eval` — runs the eval suite with a readable pass/fail report and exits
 * non-zero on any failure. Same code path as `tests/eval.test.ts`; this exists
 * for a legible console view (and the Loom demo).
 */
async function main(): Promise<void> {
  const summary = await runEvalSuite();

  for (const result of summary.results) {
    const mark = result.passed ? "PASS" : "FAIL";
    console.log(`${mark}  ${result.id.padEnd(38)} ${result.observed}`);
    for (const failure of result.failures) {
      console.log(`      - ${failure}`);
    }
  }

  console.log(
    `\n${summary.passed}/${summary.total} passed` +
      (summary.failed > 0 ? `, ${summary.failed} FAILED` : ""),
  );
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("eval runner crashed:", error);
  process.exit(1);
});
