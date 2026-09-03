# Loom walkthrough script (~12 min)

A shot-by-shot script for the recorded walkthrough. Read the **SAY** lines in your own voice —
they're a guide, not a teleprompter. **SCREEN** tells you what to have visible.

---

## Before you hit record

- [ ] `pnpm dev` running, browser at **http://localhost:3000**, window maximised.
- [ ] A second tab / editor open on the repo, with these files ready to jump to:
  - `src/lib/query-ir/schema.ts`
  - `src/lib/query-ir/interpret.ts`
  - `src/lib/executor/scope.ts`
  - `src/lib/executor/execute.ts`
  - `src/lib/api/pipeline.ts`
  - `src/lib/llm/factory.ts`
  - `src/lib/eval-runner/eval-set.json`
- [ ] A terminal ready to run `pnpm eval`.
- [ ] Clear the app's `localStorage` (or use a fresh profile) so chat history starts empty.
- [ ] Set the role switcher to **Casey Rivera — CHRO** to start.
- [ ] Close noisy notifications.

---

## 0:00 – 1:00 — What this is and the problem it solves

**SCREEN:** the landing page (`/`).

**SAY:**

> "This is _Ask Your Hiring Data_ — a read-only analytics assistant over a hiring dataset. You
> ask a question in plain English, you get back a grounded answer with a chart, or an explicit
> refusal.
>
> The brief had five hard requirements: natural-language questions, a strict wall between what
> the AI proposes and what the code does, server-side role scoping, grounded answers with
> explicit refusals, and an automated eval suite in CI. I'll show each of those working, then
> show the code that makes them true."

**DO:** scroll the landing page slowly past the "how it works" flow section.

---

## 1:00 – 2:30 — The one big idea

**SCREEN:** the README architecture diagram (open `README.md` preview, or the diagram in
`SETUP.md` section 7).

**SAY:**

> "The load-bearing decision is this: the language model is only ever allowed to _propose_ a
> small structured object — we call it the Query IR. It never writes SQL, never runs code,
> never touches the data.
>
> That proposal goes through one strict schema check. If it passes, plain deterministic
> TypeScript takes over: it applies role scoping _first_, computes the answer from an in-memory
> dataset, and returns the exact records it counted. If the proposal is malformed, or the
> model declined, or no rows match — the user gets a typed refusal that says which stage it
> failed at.
>
> So the worst a hostile prompt can do is produce a _different valid query_, or a refusal. It
> can't reach data it shouldn't or change what it's allowed to see."

---

## 2:30 – 6:30 — Live demo

### 2:30 A direct answer (as CHRO)

**SCREEN:** `/app`, empty state.

**DO:** type **"How many people are active across the company?"** → send.

**SAY:**

> "As the CHRO — org-wide scope. I get a number, a chart, a one-line summary, and down here
> 'grounded in N records' with a _show records_ toggle — those are the actual row ids and
> fields the answer was computed from. That's what 'grounded' means here: it's checkable."

**DO:** click **show records**, let it expand, collapse it again.

### 3:30 A grouped answer

**DO:** New chat → type **"show me headcount by band"** → send.

**SAY:**

> "Same grounding, rendered as a breakdown. The model proposed a `headcount_by_band` metric;
> the executor produced the four bands and cited every row."

### 4:15 A refusal

**DO:** New chat → type **"what's the weather in Berlin?"** → send.

**SAY:**

> "Off-topic. The model itself returns a refusal object, and the response tags it
> `model refusal · out of scope`. No guessing, no hallucinated number. Unsupported metrics —
> like 'median time to fill' — and questions where zero rows match are refused the same way,
> each with its own stage and reason."

### 5:00 The security boundary — the important one

**DO:** open the role switcher, select **Riley Chen — Recruiter (Engineering)**.

**SAY:** "Now I'm a recruiter scoped to Engineering only."

**DO:** New chat → type **"headcount in Sales"** → send.

**SAY:**

> "I asked about Sales. Look at the answer — it says _Headcount — Engineering_. The request
> wasn't rejected and it wasn't shown Sales' numbers. It was **silently narrowed** to my own
> job family. That happens in code, in the executor, before any maths — not in the prompt, and
> not from anything the browser sent. The browser only ever sends `{ userId, question }`; the
> server looks up the role and scope itself."

**DO:** switch back to **Casey Rivera — CHRO**, briefly show the sidebar still has Riley's
chats separate from Casey's.

### 6:00 Chat history

**SAY:**

> "History is per-principal, stored in the browser. Rename and delete per row. Reload —" **(do
> it)** "— and it comes back without flashing the empty state, because the UI waits for
> storage to hydrate before it renders."

---

## 6:30 – 10:30 — The code

### 6:30 The contract — `src/lib/query-ir/schema.ts`

**SAY:**

> "Here's the Query IR. Five metrics, a fixed filter set, two group-by fields — the model
> picks from menus, it can't invent a field. Both the query shape and the refusal shape are
> `z.strictObject`, so **any unexpected key fails the whole parse**. `LlmProposalSchema` is the
> union of the two."

**DO:** point at `METRICS`, `QueryIRSchema`, `RefusalSchema`, `LlmProposalSchema`.

### 7:15 The choke point — `src/lib/query-ir/interpret.ts`

**SAY:**

> "This is the wall. `interpretLlmProposal` runs `safeParse` and returns exactly one of three
> things: `query_ir`, `refusal`, or `invalid`. Nothing downstream ever looks at the raw model
> output again."

### 7:45 Scoping — `src/lib/executor/scope.ts`

**SAY:**

> "The security boundary, on its own, about ten lines. CHRO: filters pass through. Recruiter:
> `jobFamily` is overwritten with their own family — whatever was asked for is discarded. It's
> idempotent, so the eval suite can re-run it when it independently recomputes expected
> numbers. And `Session` is a discriminated union — a recruiter _always_ has a job family, a
> CHRO _never_ does, enforced by the type system."

### 8:30 The executor — `src/lib/executor/execute.ts`

**DO:** jump to the `export function execute(` line.

**SAY:**

> "First line of the executor: `scopeFilters(queryIR.filters, session)`. Scope is applied
> before anything else, on every query. Then it computes the metric and records the row ids
> and fields it read. 'Valid query, zero matching rows' returns a distinct failure —
> `no_matching_records` — _not_ the number zero, because those are different facts."

### 9:15 The pipeline — `src/lib/api/pipeline.ts`

**SAY:**

> "`runAskPipeline` ties it together, and `POST /api/ask` and the eval runner both call this
> exact function — so a test can never exercise a different path than a real user. Validate the
> request, resolve the session server-side, provider proposes, interpret, then either one of
> the three refusal branches or the executor. Every response is run through
> `AskResponseSchema.parse` before it leaves. And every request logs one structured line —
> who asked, resolved role and scope, what the model proposed, the outcome."

### 10:00 Providers — `src/lib/llm/factory.ts`

**SAY:**

> "One interface, `proposeQueryIR`. `MockProvider` is rule-based, no network — that's what the
> app, the tests, and the eval run on, so there's zero setup and no flakiness. `OpenAIProvider`
> is the real thing, `temperature: 0`, JSON mode, prompt pulled from a registry by id. The
> factory picks the real one only if `OPENAI_API_KEY` is set."

---

## 10:30 – 12:00 — Eval, CI, branches, wrap

### 10:30 The eval suite

**DO:** run **`pnpm eval`** in the terminal. Let the report print.

**SAY:**

> "Eighteen cases: golden answers checked by value, scoping cases including the out-of-scope
> confinement, and refusals that assert the _stage and reason_, not just 'it refused'. Same
> runner as the unit tests, so `pnpm test` is the one gate. CI runs
> format, lint, typecheck, test, eval, build on every push — no secrets."

### 11:15 The two branches

**SAY:**

> "Two branches. `assessment-core` — this one — is the graded submission: clone, `pnpm
install`, `pnpm dev`, no database, three demo roles. `main` takes the identical core engine
> and wraps it in real auth, Postgres, per-org datasets, and full RBAC. The query-IR, executor,
> scoping and eval are byte-for-byte the same in both."

### 11:40 Wrap

**SAY:**

> "So: the model proposes, a strict schema decides, plain code enforces scope and does the
> maths, and every answer is either grounded in named records or an explicit typed refusal —
> with an eval suite in CI to keep it that way. Thanks for watching."

---

## If you have extra time (cut first if short)

- `pnpm build` succeeding, to show it's production-clean.
- The `.env.example` → `.env.local` flow and re-asking a question on the real model.
- `PROCESS.md` "toolchain sharp edges" — the Turbopack/Tailwind dev bug and why `dev` is
  pinned to `--webpack`.
