import { describe, expect, it } from "vitest";
import { seedFromSlug, slugify } from "@/lib/tenancy";

describe("slugify", () => {
  it("lowercases, replaces runs of non-alphanumerics with a single dash, trims", () => {
    expect(slugify("Acme Corp!")).toBe("acme-corp");
    expect(slugify("  Hooli   Inc.  ")).toBe("hooli-inc");
    expect(slugify("--Weird__Name--")).toBe("weird-name");
  });

  it("falls back to 'org' for empty input and caps length at 40", () => {
    expect(slugify("   ")).toBe("org");
    expect(slugify("!!!")).toBe("org");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(40);
  });
});

describe("seedFromSlug", () => {
  it("is deterministic, differs by slug, and stays in range", () => {
    expect(seedFromSlug("acme")).toBe(seedFromSlug("acme"));
    expect(seedFromSlug("acme")).not.toBe(seedFromSlug("globex"));
    const seed = seedFromSlug("some-workspace");
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2_000_000_000);
    expect(Number.isInteger(seed)).toBe(true);
  });
});
