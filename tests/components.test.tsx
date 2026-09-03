// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerView } from "@/components/answer-view";
import { Chat } from "@/components/chat";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const answered: AnsweredResponse = {
  status: "answered",
  metric: "headcount",
  kind: "scalar",
  value: 10,
  unit: "count",
  appliedFilters: { jobFamily: "Engineering" },
  citations: {
    recordIds: ["emp_0006", "emp_0007"],
    fields: ["active", "jobFamilyId"],
    recordCount: 2,
  },
  chart: { kind: "single", unit: "count", label: "Headcount — Engineering", value: 10 },
  summary: "Headcount — Engineering: 10 (grounded in 2 records).",
};

const refused: RefusedResponse = {
  status: "refused",
  stage: "model_refusal",
  reason: "out_of_scope",
  message: "I can only answer questions about this hiring dataset.",
};

describe("AnswerView", () => {
  it("renders a grounded answer: summary, chart, and the grounding line", () => {
    render(<AnswerView response={answered} />);
    expect(screen.getByText(/Headcount — Engineering: 10/)).toBeInTheDocument();
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
    expect(screen.getByTestId("grounded-line")).toHaveTextContent("Grounded in 2 records");
    expect(screen.getByText(/active, jobFamilyId/)).toBeInTheDocument();
  });

  it("toggles the cited record ids", async () => {
    const user = userEvent.setup();
    render(<AnswerView response={answered} />);
    expect(screen.queryByText(/emp_0006/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show records/i }));
    expect(screen.getByText("emp_0006, emp_0007")).toBeInTheDocument();
  });

  it("renders a refusal with its message and a reason/stage chip", () => {
    render(<AnswerView response={refused} />);
    expect(screen.getByTestId("refused")).toHaveTextContent(/hiring dataset/);
    expect(screen.getByText(/out of scope · model refusal/)).toBeInTheDocument();
  });
});

describe("Chat", () => {
  it("submits a question and renders the answer from /api/ask", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL) => {
        const target = String(url);
        const body = target.includes("/api/users")
          ? {
              users: [
                {
                  id: "chro",
                  displayName: "Casey — CHRO",
                  role: "chro",
                  scope: "Organization-wide",
                },
              ],
            }
          : answered;
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }),
    );

    render(<Chat />);
    await user.type(screen.getByLabelText("Question"), "headcount in engineering");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByTestId("answered")).toBeInTheDocument();
    expect(screen.getByText(/Headcount — Engineering: 10/)).toBeInTheDocument();
  });

  it("clears the transcript when the role changes (no cross-role leakage)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL) => {
        const target = String(url);
        const body = target.includes("/api/users")
          ? {
              users: [
                {
                  id: "chro",
                  displayName: "Casey — CHRO",
                  role: "chro",
                  scope: "Organization-wide",
                },
                {
                  id: "recruiter_eng",
                  displayName: "Riley — Recruiter (Engineering)",
                  role: "recruiter",
                  scope: "Engineering only",
                },
              ],
            }
          : answered;
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }),
    );

    render(<Chat />);
    await user.type(screen.getByLabelText("Question"), "headcount");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByTestId("answered")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "recruiter_eng");

    expect(screen.queryByTestId("answered")).not.toBeInTheDocument();
    expect(screen.getByText(/Previous results cleared/)).toBeInTheDocument();
  });

  it("shows an error bubble when /api/ask returns a 400", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL) => {
        const target = String(url);
        if (target.includes("/api/users")) {
          return Promise.resolve(new Response(JSON.stringify({ users: [] }), { status: 200 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 }),
        );
      }),
    );

    render(<Chat />);
    await user.type(screen.getByLabelText("Question"), "anything");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Invalid request body.")).toBeInTheDocument();
  });
});
