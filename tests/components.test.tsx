// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerView } from "@/components/answer-view";
import { Chat } from "@/components/chat";
import { ChatStoreProvider } from "@/components/chat-store";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";

const renderChat = () => render(<Chat />, { wrapper: ChatStoreProvider });

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

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
  it("shows suggestions in the empty state", () => {
    renderChat();
    expect(screen.getByText("Headcount by band")).toBeInTheDocument();
  });

  it("posts { userId, question } and renders the answer", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((_url: string | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify(answered), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderChat();
    await user.type(screen.getByLabelText("Question"), "headcount in engineering");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByTestId("answered")).toBeInTheDocument();
    expect(screen.getByText(/Headcount — Engineering: 10/)).toBeInTheDocument();
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("/api/ask");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      userId: "chro",
      question: "headcount in engineering",
    });
  });

  it("shows an error bubble when /api/ask returns a 400", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 }),
        ),
      ),
    );

    renderChat();
    await user.type(screen.getByLabelText("Question"), "anything");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Invalid request body.")).toBeInTheDocument();
  });
});
