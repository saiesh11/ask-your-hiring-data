// Public surface of the data module: the validated dataset and its types.
// The generator (`./generate`) and PRNG (`./prng`) are build-time concerns and
// are imported directly by `scripts/seed.ts` and tests, not re-exported here.
export * from "./schema";
export * from "./loader";
