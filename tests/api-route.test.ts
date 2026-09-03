import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/ask/route";
import { GET } from "@/app/api/users/route";
import { AskResponseSchema, UsersResponseSchema } from "@/lib/api";

function askRequest(body: unknown, { raw }: { raw?: string } = {}): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

describe("POST /api/ask", () => {
  it("200 + schema-valid answered response for a good question", async () => {
    const res = await POST(askRequest({ userId: "chro", question: "headcount by band" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(AskResponseSchema.safeParse(body).success).toBe(true);
    expect(body.status).toBe("answered");
    expect(body.metric).toBe("headcount_by_band");
  });

  it("200 + refused response for an out-of-scope question", async () => {
    const res = await POST(askRequest({ userId: "chro", question: "what's the weather?" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "refused", stage: "model_refusal" });
  });

  it("role scoping is visible in the HTTP response", async () => {
    const res = await POST(
      askRequest({ userId: "recruiter_sales", question: "headcount in Engineering" }),
    );
    const body = await res.json();
    expect(body.appliedFilters.jobFamily).toBe("Sales");
  });

  it("400 when the body is not valid JSON", async () => {
    const res = await POST(askRequest(null, { raw: "not json{" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid JSON/i);
  });

  it("400 with issues when the body shape is wrong", async () => {
    const res = await POST(askRequest({ question: "hi" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("400 for an unknown user", async () => {
    const res = await POST(askRequest({ userId: "intruder", question: "headcount" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/users", () => {
  it("200 + the three demo accounts, schema-valid", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(UsersResponseSchema.safeParse(body).success).toBe(true);
    expect(body.users.map((u: { id: string }) => u.id).sort()).toEqual([
      "chro",
      "recruiter_eng",
      "recruiter_sales",
    ]);
    expect(body.users.find((u: { id: string }) => u.id === "recruiter_eng").scope).toMatch(
      /Engineering/,
    );
  });
});
