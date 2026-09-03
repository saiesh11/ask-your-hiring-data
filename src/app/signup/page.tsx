"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { BackIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  ["name", "Name", "text"],
  ["orgName", "Organization", "text"],
  ["email", "Work email", "email"],
  ["password", "Password", "password"],
] as const;

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
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* ambient wash so the frosted panel has something to catch */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 -bottom-32 size-[480px] rounded-full bg-primary/[0.06] blur-3xl" />
      </div>

      <header className="relative z-10 p-6">
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

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.055] p-10 shadow-2xl backdrop-blur-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Create your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A synthetic hiring dataset is generated the moment you land.
          </p>

          <form onSubmit={onSubmit} className="mt-9 grid gap-6">
            {FIELDS.map(([key, label, type]) => (
              <div key={key} className="grid gap-2.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type}
                  required
                  minLength={type === "password" ? 8 : undefined}
                  placeholder={key === "password" ? "8+ characters" : undefined}
                  value={form[key]}
                  onChange={set(key)}
                />
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
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
    </main>
  );
}
