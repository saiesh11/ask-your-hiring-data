"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { BackIcon } from "@/components/icons";
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
        {/* the glass box: contained, translucent grey, blurred, roomy */}
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.055] p-10 shadow-2xl backdrop-blur-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>

          <form onSubmit={onSubmit} className="mt-9 grid gap-6">
            <div className="grid gap-2.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2.5">
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
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-7 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
              Create a workspace
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
