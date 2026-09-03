"use client";

import { useState } from "react";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setPending(false);
      setError(body?.error ?? "Could not accept the invitation.");
      return;
    }
    window.location.href = "/app";
  }

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        style={{
          font: "inherit",
          padding: "0.55rem 1.1rem",
          border: "none",
          borderRadius: 8,
          background: "var(--brand)",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {pending ? "Joining…" : "Accept invitation"}
      </button>
      {error && <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>}
    </div>
  );
}
