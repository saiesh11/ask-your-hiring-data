"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", orgName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setPending(false);
      setError(body?.error ?? "Could not create the account.");
      return;
    }

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setPending(false);
    if (!result || result.error) {
      setError("Account created, but sign-in failed. Try logging in.");
      return;
    }
    window.location.href = "/app";
  }

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", padding: "0 1.25rem" }}>
      <h1 style={{ fontSize: "1.3rem" }}>Create your workspace</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", marginTop: "1.25rem" }}>
        {(
          [
            ["name", "Your name", "text"],
            ["orgName", "Organization name", "text"],
            ["email", "Work email", "email"],
            ["password", "Password (min 8 chars)", "password"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            {label}
            <input
              type={type}
              required
              minLength={type === "password" ? 8 : undefined}
              value={form[key]}
              onChange={set(key)}
              style={inputStyle}
            />
          </label>
        ))}
        {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? "Creating…" : "Create workspace"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--dim)" }}>
        Already have an account? <Link href="/login">Log in</Link>
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
