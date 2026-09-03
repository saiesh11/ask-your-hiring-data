import Link from "next/link";
import { ChatIcon, GroundedIcon, ModelIcon, ScopeIcon, SparkIcon } from "@/components/icons";
import { Num } from "@/components/num";
import { SpaceBackground } from "@/components/space-background";
import { Button } from "@/components/ui/button";

const BENTO = [
  {
    icon: ChatIcon,
    term: "Ask, don't build",
    desc: "Plain-English questions instead of another dashboard.",
  },
  {
    icon: GroundedIcon,
    term: "Grounded answers",
    desc: "Every answer cites the exact records and fields it used — or says it can't.",
  },
  {
    icon: ScopeIcon,
    term: "Scoped by role",
    desc: "A recruiter sees their job families; a CHRO sees the org. Enforced server-side.",
  },
  {
    icon: ModelIcon,
    term: "The model proposes, code decides",
    desc: "The LLM only emits a schema-validated query. A deterministic executor runs it.",
  },
] as const;

const STEPS = [
  ["Ask in English", "“How many people are active in Engineering?”"],
  ["Model emits a validated query", "A typed query object — never SQL, never free-form."],
  ["Executor returns a grounded answer", "With the records and fields it counted, and a chart."],
] as const;

function FlowArrow() {
  return (
    <div className="flex items-center justify-center py-2 md:py-0" aria-hidden>
      <svg
        width="44"
        height="14"
        viewBox="0 0 44 14"
        className="text-primary/50 max-md:rotate-90"
        fill="none"
      >
        <line
          x1="0"
          y1="7"
          x2="34"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <path d="M32 1.5 L42 7 L32 12.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SpaceBackground />

      <header className="drop-in mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
            <SparkIcon className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Ask Your Hiring Data</span>
        </div>
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
          </div>
        </section>

        <p
          className="rise-in border-y py-4 text-center font-mono text-xs text-muted-foreground"
          style={{ animationDelay: "420ms" }}
        >
          synthetic data · read-only · no integration with any real HR system
        </p>

        {/* four differentiators */}
        <section className="grid gap-4 py-16 sm:grid-cols-2">
          {BENTO.map(({ icon: Icon, term, desc }, i) => (
            <div
              key={term}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-6 backdrop-blur-md transition-colors hover:border-primary/40"
            >
              <span className="pointer-events-none absolute top-5 right-6 font-mono text-xs text-muted-foreground/40">
                0{i + 1}
              </span>
              <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
                <Icon className="size-[18px]" />
              </span>
              <h3 className="mt-4 font-medium">{term}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
              <span className="absolute bottom-0 left-0 h-px w-0 bg-primary transition-all duration-500 group-hover:w-full" />
            </div>
          ))}
        </section>

        {/* how it works — a real sequence, drawn as a flow */}
        <section className="border-t py-16">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {STEPS.map(([title, detail], i) => (
              <div key={title} className="contents">
                <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-md">
                  <span className="inline-grid size-7 place-items-center rounded-lg bg-primary/15 font-mono text-xs text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                </div>
                {i < STEPS.length - 1 && <FlowArrow />}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 font-mono text-xs text-muted-foreground">
        ask your hiring data — a read-only analytics assistant. synthetic data only.
      </footer>
    </div>
  );
}
