"use client";

import { useEffect, useRef, useState } from "react";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnswerView } from "./answer-view";

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; response: AnsweredResponse | RefusedResponse }
  | { role: "error"; text: string };

const SUGGESTIONS = [
  "How many people are active across the company?",
  "Show me headcount by band",
  "Open requisitions by job family",
  "Average time to fill for Sales roles",
  "How many hires did we make in 2024?",
];

function isAskResponse(value: unknown): value is AnsweredResponse | RefusedResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    ((value as { status?: unknown }).status === "answered" ||
      (value as { status?: unknown }).status === "refused")
  );
}

export function Chat() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    return () => cancelAnimationFrame(raf);
  }, [turns, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text: trimmed }]);
    setPending(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (body as { error?: string } | null)?.error ?? `Request failed (${res.status}).`;
        setTurns((prev) => [...prev, { role: "error", text: message }]);
      } else if (isAskResponse(body)) {
        setTurns((prev) => [...prev, { role: "assistant", response: body }]);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: "error", text: "Unexpected response from the server." },
        ]);
      }
    } catch {
      setTurns((prev) => [...prev, { role: "error", text: "Network error." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div ref={transcriptRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6">
        {turns.length === 0 && (
          <div className="text-sm text-muted-foreground">
            <p>Ask a plain-English question about your hiring data.</p>
            <ul className="mt-2 space-y-1">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="text-left text-primary hover:underline"
                    onClick={() => ask(s)}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex"}>
            {turn.role === "user" ? (
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {turn.text}
              </div>
            ) : turn.role === "error" ? (
              <div className="rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive">
                {turn.text}
              </div>
            ) : (
              <div className="w-full rounded-lg border p-3">
                <AnswerView response={turn.response} />
              </div>
            )}
          </div>
        ))}

        {pending && <div className="text-sm text-muted-foreground">Thinking…</div>}
      </div>

      <form
        className="flex gap-2 border-t bg-background py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How many senior hires did we make in Q2 2024?"
          aria-label="Question"
        />
        <Button type="submit" disabled={pending || input.trim().length === 0}>
          Ask
        </Button>
      </form>
    </div>
  );
}
