"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import type { AnsweredResponse, RefusedResponse } from "@/lib/api";
import { AnswerView } from "./answer-view";
import styles from "./chat.module.css";

export interface ChatViewer {
  name: string;
  orgName: string;
  role: string;
  scopeLabel: string;
}

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

export function Chat({ me }: { me: ChatViewer }) {
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
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{me.orgName}</h1>
          <p className={styles.subtitle}>
            {me.name} · {me.role} · scoped to {me.scopeLabel}
          </p>
        </div>
        <button
          type="button"
          className={styles.signout}
          onClick={() => void signOut({ redirectTo: "/" })}
        >
          Sign out
        </button>
      </header>

      <div className={styles.transcript} ref={transcriptRef}>
        {turns.length === 0 && (
          <div className={styles.empty}>
            <p>Ask a plain-English question about your hiring data.</p>
            <ul>
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className={styles.suggestion} onClick={() => ask(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={`${styles.row} ${styles[turn.role]}`}>
            <div className={styles.bubble}>
              {turn.role === "assistant" ? <AnswerView response={turn.response} /> : turn.text}
            </div>
          </div>
        ))}

        {pending && <div className={styles.pending}>Thinking…</div>}
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How many senior hires did we make in Q2 2024?"
          aria-label="Question"
        />
        <button type="submit" disabled={pending || input.trim().length === 0}>
          Ask
        </button>
      </form>
    </div>
  );
}
