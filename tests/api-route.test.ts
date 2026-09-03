import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORG_WIDE, scopedTo } from "@/lib/executor";
import { DEFAULT_SEED, InMemoryHiringDataSource } from "@/lib/hiring-data";
import { AskResponseSchema } from "@/lib/api";

const { requireContext, UnauthenticatedError, NoOrganizationError } = vi.hoisted(() => {
  class UnauthenticatedError extends Error {}
  class NoOrganizationError extends Error {}
  return { requireContext: vi.fn(), UnauthenticatedError, NoOrganizationError };
});

vi.mock("@/lib/tenancy/context", () => ({
  requireContext,
  UnauthenticatedError,
  NoOrganizationError,
}));

// eslint-disable-next-line import/first -- must follow vi.mock (hoisted above)
import { POST } from "@/app/api/ask/route";

function grant(overrides: Record<string, unknown> = {}): void {
  requireContext.mockResolvedValue({
    user: { id: "u1", name: "T", email: "t@example.com" },
    org: { id: "o1", name: "Org", slug: "org", dataSeed: DEFAULT_SEED },
    membership: { role: "CHRO", jobFamilyScope: [] },
    permissions: [],
    executionContext: ORG_WIDE,
    hiringData: new InMemoryHiringDataSource(DEFAULT_SEED),
    ...overrides,
  });
}

function askRequest(body: unknown, raw?: string): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => requireContext.mockReset());

describe("POST /api/ask", () => {
  it("200 + schema-valid answered response for a good question", async () => {
    grant();
    const res = await POST(askRequest({ question: "headcount by band" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(AskResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ status: "answered", metric: "headcount_by_band" });
  });

  it("200 + refused response for an out-of-scope question", async () => {
    grant();
    const res = await POST(askRequest({ question: "what's the weather?" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "refused", stage: "model_refusal" });
  });

  it("job-family scoping from the session is visible in the response", async () => {
    grant({
      executionContext: scopedTo(["Sales"]),
      membership: { role: "RECRUITER", jobFamilyScope: [] },
    });
    const res = await POST(askRequest({ question: "headcount in Engineering" }));
    expect((await res.json()).scope).toEqual({ jobFamilies: ["Sales"] });
  });

  it("401 when not signed in", async () => {
    requireContext.mockImplementationOnce(async () => {
      throw new UnauthenticatedError();
    });
    const res = await POST(askRequest({ question: "headcount" }));
    expect(res.status).toBe(401);
  });

  it("403 when the user has no organization", async () => {
    requireContext.mockImplementationOnce(async () => {
      throw new NoOrganizationError();
    });
    const res = await POST(askRequest({ question: "headcount" }));
    expect(res.status).toBe(403);
  });

  it("400 when the body is not valid JSON", async () => {
    grant();
    const res = await POST(askRequest(null, "not json{"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid JSON/i);
  });

  it("400 with issues when the body shape is wrong", async () => {
    grant();
    const res = await POST(askRequest({}));
    expect(res.status).toBe(400);
    expect(Array.isArray((await res.json()).issues)).toBe(true);
  });
});
