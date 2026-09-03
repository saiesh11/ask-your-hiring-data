"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      {/* ambient wash so the frosted panel has something to catch */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 size-[440px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 size-[440px] rounded-full bg-primary/[0.06] blur-3xl" />
      </div>

      <Link
        href="/"
        className="absolute top-6 left-6 font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        ask your hiring data
      </Link>

      {/* the glass box: contained, translucent gray, blurred */}
      <div className="relative w-full max-w-sm rounded-2xl border bg-card/60 p-8 shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>

        <form onSubmit={onSubmit} className="mt-8 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="mt-1 w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Create a workspace
          </Link>
        </p>
      </div>
    </main>
  );
}
