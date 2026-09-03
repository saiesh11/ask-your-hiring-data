import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";

// TODO(step-1): Replace this scaffold smoke test with the real query-ir schema
// suite (proving rejection of malformed / injected LLM output). "Done" means
// tests/query-ir.test.ts exists and this file is deleted.
describe("scaffold smoke", () => {
  it("runs the vitest pipeline", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/* path alias", () => {
    expect(metadata.title).toBe("Ask Your Hiring Data");
  });
});
