"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthSplit } from "@/components/auth-split";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  ["name", "Your name", "text"],
  ["orgName", "Organization name", "text"],
  ["email", "Work email", "email"],
  ["password", "Password (min 8 characters)", "password"],
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
    <AuthSplit mode="signup">
      <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A synthetic hiring dataset is seeded on arrival.
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {FIELDS.map(([key, label, type]) => (
          <div key={key} className="grid gap-2">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              type={type}
              required
              minLength={type === "password" ? 8 : undefined}
              value={form[key]}
              onChange={set(key)}
            />
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create workspace"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthSplit>
  );
}
