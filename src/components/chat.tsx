"use client";

import { useEffect, useRef, useState } from "react";
import type { AnsweredResponse, DemoUserPublic, RefusedResponse } from "@/lib/api";
import { AnswerView } from "./answer-view";
import styles from "./chat.module.css";

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; response: AnsweredResponse | RefusedResponse }
  | { role: "system"; text: string }
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
  const [users, setUsers] = useState<DemoUserPublic[]>([]);
  const [userId, setUserId] = useState("chro");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((body: { users?: DemoUserPublic[] }) => {
        if (body.users) setUsers(body.users);
      })
      .catch(() => {
        /* switcher stays with the default */
      });
  }, []);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    // Re-scroll after layout settles (the chart mounts with a fixed height).
    const raf = requestAnimationFrame(toBottom);
    return () => cancelAnimationFrame(raf);
  }, [turns, pending]);

  function switchUser(nextUserId: string) {
    if (nextUserId === userId) return;
    setUserId(nextUserId);
    setInput("");
    // Never carry one role's answers into another view.
    setTurns((prev) => {
      if (prev.length === 0) return [];
      const next = users.find((u) => u.id === nextUserId);
      const scope = next ? ` — ${next.scope.toLowerCase()}` : "";
      return [
        {
          role: "system",
          text: `Now viewing as ${next?.displayName ?? nextUserId}${scope}. Previous results cleared.`,
        },
      ];
    });
  }

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
        body: JSON.stringify({ userId, question: trimmed }),
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

  const activeUser = users.find((u) => u.id === userId);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Ask Your Hiring Data</h1>
        <label className={styles.switcher}>
          Viewing as
          <select value={userId} onChange={(e) => switchUser(e.target.value)}>
            {(users.length > 0
              ? users
              : [{ id: "chro", displayName: "CHRO", role: "chro", scope: "" }]
            ).map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className={styles.transcript} ref={transcriptRef}>
        {turns.length === 0 && (
          <div className={styles.empty}>
            <p>
              Ask a plain-English question about the synthetic hiring dataset
              {activeUser ? ` — you're scoped to: ${activeUser.scope.toLowerCase()}.` : "."}
            </p>
            <ul>
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => ask(s)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      padding: 0,
                      font: "inherit",
                    }}
                  >
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
