"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon, SparkIcon } from "@/components/icons";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AnswerView } from "./answer-view";
import { useChatStore } from "./chat-store";

const SUGGESTIONS = [
  "How many people are active across the company?",
  "Headcount by band",
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const empty = activeTurns.length === 0 && !pending;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeTurns, pending]);

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setInput("");
    requestAnimationFrame(autosize);
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

  const composer = (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        void ask(input);
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm transition-colors focus-within:border-ring">
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
          placeholder="Ask about your hiring data…"
          aria-label="Question"
          className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          disabled={pending || !input.trim()}
        >
          <SendIcon className="size-4" />
          <span className="sr-only">Ask</span>
        </Button>
      </div>
    </form>
  );

  if (empty) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-7 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-2xl border bg-card text-primary">
            <SparkIcon className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Ask your hiring data
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Plain-English questions. Grounded, role-scoped answers with a chart.
          </p>
        </div>
        {composer}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* full-width scroll — the scrollbar sits at the far right of the panel */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {activeTurns.map((turn, i) => (
            <div key={i} className={turn.role === "user" ? "flex justify-end" : ""}>
              {turn.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl bg-muted px-3.5 py-2 text-sm">
                  {turn.text}
                </div>
              ) : turn.role === "error" ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
                  {turn.text}
                </div>
              ) : (
                <div className="rounded-xl border bg-card p-4">
                  <AnswerView response={turn.response} />
                </div>
              )}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SparkIcon className="size-4 animate-pulse text-primary" /> Analyzing…
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-4">{composer}</div>
      </div>
    </div>
  );
}
