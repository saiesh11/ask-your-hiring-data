"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setPending(false);
    if (!result || result.error) {
      setError("Invalid email or password.");
      return;
    }
    const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
    window.location.href = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/app";
  }

  return (
    <main style={{ maxWidth: 380, margin: "5rem auto", padding: "0 1.25rem" }}>
      <h1 style={{ fontSize: "1.3rem" }}>Log in</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", marginTop: "1.25rem" }}>
        <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--dim)" }}>
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  font: "inherit",
  padding: "0.5rem 0.65rem",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--paper)",
  color: "var(--ink)",
};

const buttonStyle: React.CSSProperties = {
  font: "inherit",
  padding: "0.55rem 1rem",
  border: "none",
  borderRadius: 8,
  background: "var(--brand)",
  color: "#fff",
  cursor: "pointer",
};
