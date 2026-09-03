import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  ["Ask, don't build", "Plain-English questions instead of another dashboard."],
  [
    "Grounded answers",
    "Every answer cites the exact records and fields it used, or says it doesn't know.",
  ],
  ["Scoped by role", "A recruiter sees their families; a CHRO sees the org. Enforced server-side."],
  [
    "The model proposes, code decides",
    "The LLM only emits a schema-validated query object — a deterministic executor runs it.",
  ],
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-16">
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">Ask Your Hiring Data</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A natural-language analytics assistant for your hiring data.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
          Read-only, grounded, and role-scoped. Create a workspace and it seeds a synthetic hiring
          dataset you can start asking questions of immediately.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Create a workspace</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Log in</Link>
          </Button>
        </div>

        <dl className="mt-16 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FEATURES.map(([term, desc]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
      <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground">
        Synthetic data only. No integration with any real HR system.
      </footer>
    </main>
  );
}
