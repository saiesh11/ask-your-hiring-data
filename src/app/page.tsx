import Link from "next/link";
import { SparkIcon } from "@/components/icons";
import { Num } from "@/components/num";
import { SpaceBackground } from "@/components/space-background";
import { Button } from "@/components/ui/button";

const BENTO = [
  ["Ask, don't build", "Plain-English questions instead of another dashboard."],
  [
    "Grounded answers",
    "Every answer cites the exact records and fields it used — or says it can't.",
  ],
  [
    "Scoped by role",
    "A recruiter sees their job families; a CHRO sees the org. Enforced server-side.",
  ],
  [
    "The model proposes, code decides",
    "The LLM only emits a schema-validated query. A deterministic executor runs it.",
  ],
] as const;

const STEPS = [
  ["Ask in English", "“How many people are active in Engineering?”"],
  ["Model emits a validated query", "A typed query object — never SQL, never free-form."],
  ["Executor returns a grounded answer", "With the records and fields it counted, and a chart."],
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SpaceBackground />
      <header className="drop-in mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-mono text-xs tracking-wide text-muted-foreground">
          ask your hiring data
        </span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Create a workspace</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        {/* hero */}
        <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="drop-in text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Ask your hiring data.
            </h1>
            <p
              className="drop-in mt-5 max-w-md text-lg text-pretty text-muted-foreground"
              style={{ animationDelay: "100ms" }}
            >
              Plain-English questions over a read-only hiring dataset. Grounded, role-scoped answers
              with a chart — the model proposes a validated query, code decides.
            </p>
            <div className="drop-in mt-8 flex gap-3" style={{ animationDelay: "200ms" }}>
              <Button asChild size="lg">
                <Link href="/signup">Create a workspace</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">See an example</Link>
              </Button>
            </div>
          </div>

          {/* answer-card mock */}
          <div
            className="drop-in rounded-2xl border border-white/10 bg-card/60 p-5 shadow-sm backdrop-blur-md"
            style={{ animationDelay: "320ms" }}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-muted-foreground">
              <SparkIcon className="size-3.5 text-primary" /> answer · headcount
            </div>
            <p className="mt-3 text-sm font-medium">Headcount — Engineering: 43 active.</p>
            <div className="mt-3 rounded-lg border p-3">
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Headcount · Engineering
              </div>
              <div className="mt-1 text-2xl font-semibold text-primary">
                <Num>43</Num>
              </div>
              <div className="mt-3 flex items-end gap-1.5">
                {[34, 52, 41, 63, 48, 71].map((h, i) => (
                  <span
                    key={i}
                    className="w-6 rounded-sm bg-primary"
                    style={{ height: h, opacity: 0.35 + i * 0.12 }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              grounded in 2 records · emp_0006, emp_0007
            </p>
          </div>
        </section>

        <p
          className="rise-in border-y py-4 text-center font-mono text-xs text-muted-foreground"
          style={{ animationDelay: "420ms" }}
        >
          synthetic data · read-only · no integration with any real HR system
        </p>

        {/* bento */}
        <section className="grid gap-4 py-14 sm:grid-cols-2">
          {BENTO.map(([term, desc]) => (
            <div
              key={term}
              className="rounded-xl border border-white/10 bg-card/60 p-5 backdrop-blur-md"
            >
              <h3 className="font-medium">{term}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>

        {/* how it works — an actual sequence, so numbered */}
        <section className="border-t py-14">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map(([title, detail], i) => (
              <li key={title}>
                <span className="font-mono text-xs text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* closing CTA */}
        <section className="my-14 rounded-2xl border border-white/10 bg-card/60 px-6 py-10 text-center backdrop-blur-md">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Create a workspace and start asking.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A demo hiring dataset is generated for you on signup.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/signup">Create a workspace</Link>
          </Button>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 font-mono text-xs text-muted-foreground">
        ask your hiring data — a read-only analytics assistant. synthetic data only.
      </footer>
    </div>
  );
}
