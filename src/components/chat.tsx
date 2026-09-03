"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnswerView } from "./answer-view";
import { useChatStore } from "./chat-store";

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
  const { activeTurns, appendTurn } = useChatStore();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const empty = activeTurns.length === 0 && !pending;

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    return () => cancelAnimationFrame(raf);
  }, [activeTurns, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setInput("");
    appendTurn({ role: "user", text: trimmed });
    setPending(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        appendTurn({
          role: "error",
          text: (body as { error?: string } | null)?.error ?? `Request failed (${res.status}).`,
        });
      } else if (isAskResponse(body)) {
        appendTurn({ role: "assistant", response: body });
      } else {
        appendTurn({ role: "error", text: "Unexpected response from the server." });
      }
    } catch {
      appendTurn({ role: "error", text: "Network error." });
    } finally {
      setPending(false);
    }
  }

  const form = (
    <form
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void ask(input);
      }}
    >
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about your hiring data…"
        aria-label="Question"
        className="h-11"
      />
      <Button type="submit" size="icon" className="h-11 w-11" disabled={pending || !input.trim()}>
        <SendHorizontal />
        <span className="sr-only">Ask</span>
      </Button>
    </form>
  );

  if (empty) {
    return (
      <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full border p-2.5 text-muted-foreground">
            <Sparkles className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">Ask your hiring data</h1>
          <p className="text-sm text-muted-foreground">
            Plain-English questions. Grounded, role-scoped answers with a chart.
          </p>
        </div>
        {form}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => ask(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-4">
      <div ref={transcriptRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6">
        {activeTurns.map((turn, i) => (
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
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse" /> Thinking…
          </div>
        )}
      </div>
      <div className="shrink-0 border-t bg-background py-3">{form}</div>
    </div>
  );
}
