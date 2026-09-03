import { describe, expect, it } from "vitest";
import { getPrompt, listPrompts, type PromptId } from "@/lib/prompt-registry";
import { JOB_FAMILIES, BANDS, METRICS, REFUSAL_REASONS } from "@/lib/query-ir";

describe("prompt registry", () => {
  it("returns a record by its stable id", () => {
    const record = getPrompt("propose-query-ir@v1");
    expect(record.id).toBe("propose-query-ir@v1");
    expect(record.text.length).toBeGreaterThan(200);
    expect(record.description).toMatch(/query ir/i);
  });

  it("throws on an unknown id (no silent fallback)", () => {
    expect(() => getPrompt("does-not-exist@v9" as PromptId)).toThrow(/unknown prompt id/i);
  });

  it("listPrompts returns every registered prompt", () => {
    expect(listPrompts().map((p) => p.id)).toContain("propose-query-ir@v1");
  });

  it("the propose-query-ir prompt stays in sync with the schema vocabulary", () => {
    const { text } = getPrompt("propose-query-ir@v1");
    for (const metric of METRICS) expect(text, metric).toContain(metric);
    for (const reason of REFUSAL_REASONS) expect(text, reason).toContain(reason);
    for (const family of JOB_FAMILIES) expect(text, family).toContain(family);
    for (const band of BANDS) expect(text, band).toContain(band);
  });
});
