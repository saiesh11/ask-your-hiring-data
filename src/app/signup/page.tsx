"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { BackIcon, SparkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  ["name", "Name", "text"],
  ["orgName", "Organization", "text"],
  ["email", "Work email", "email"],
  ["password", "Password", "password"],
] as const;

const VALUE = [
  "Cites the exact records and fields behind every answer",
  "Role-scoped server-side — a recruiter sees only their families",
  "Read-only. The model proposes a query; code decides",
];

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

  const field = ([key, label, type]: (typeof FIELDS)[number]) => (
    <div key={key} className="grid gap-2.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        required
        minLength={type === "password" ? 8 : undefined}
        placeholder={key === "password" ? "8+ characters" : undefined}
        className="h-11"
        value={form[key]}
        onChange={set(key)}
      />
    </div>
  );

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* ambient wash so the frosted panel has something to catch */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 size-[560px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-40 -bottom-40 size-[520px] rounded-full bg-primary/[0.06] blur-3xl" />
      </div>

      <header className="relative z-10 shrink-0 p-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Link href="/">
            <BackIcon className="size-4" />
            Back
          </Link>
        </Button>
      </header>

      <div className="relative z-10 grid flex-1 lg:grid-cols-[1fr_1.6fr]">
        {/* LEFT — slim, plain text */}
        <aside className="hidden flex-col justify-center gap-7 border-r border-white/10 px-10 lg:flex">
          <span className="grid size-10 place-items-center rounded-xl border bg-card text-primary">
            <SparkIcon className="size-5" />
          </span>
          <p className="max-w-xs text-lg font-medium text-balance">
            Grounded, role-scoped answers over your hiring data.
          </p>
          <ul className="flex max-w-xs flex-col gap-3 text-sm text-muted-foreground">
            {VALUE.map((v) => (
              <li key={v} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {v}
              </li>
            ))}
          </ul>
        </aside>

        {/* RIGHT — the form, roomy frosted panel */}
        <div className="flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.055] p-8 shadow-2xl backdrop-blur-2xl sm:p-12">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              Create your workspace
            </h1>
            <p className="mt-2 text-muted-foreground">
              A synthetic hiring dataset is generated the moment you land.
            </p>

            <form onSubmit={onSubmit} className="mt-9 grid gap-6">
              <div className="grid gap-6 sm:grid-cols-2">{FIELDS.slice(0, 2).map(field)}</div>
              {FIELDS.slice(2).map(field)}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
                {pending ? "Creating…" : "Create workspace"}
              </Button>
            </form>

            <p className="mt-7 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
