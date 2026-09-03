# The whole project, explained in plain language

This document is for someone who wants to understand **everything** about this project without
assuming much background: what it does, every technology in it and why it's there, what we
_didn't_ use and why, the problems we hit along the way, and a long list of likely interview
questions with plain-English answers.

If a word looks like jargon, check the [Glossary](#glossary) at the bottom — every technical
term is defined there in one line.

---

## 1. What this project is, in one paragraph

It's a website where you type a plain-English question about a company's hiring data —
_"how many people work in Engineering?"_ — and get back a **correct, grounded answer with a
chart**, or a clear **"I can't answer that."** The twist: the AI model is **never allowed to
touch the data or run code**. All the model does is translate your sentence into a small,
strictly-checked "order form". Then ordinary, predictable program code reads that order form,
checks it, enforces who's allowed to see what, does the maths, and shows the result along with
the exact records it counted.

---

## 2. The problem the assessment asked us to solve

The brief asked for an assistant that:

1. Answers natural-language questions over a hiring dataset — **read only**, no changing data.
2. Has a **hard wall** between "the AI proposes something" and "our code decides what actually
   happens".
3. Enforces **role-based access** on the server: a recruiter constrained to their own area
   must not be able to see the whole company, no matter how they phrase the question.
4. Gives **grounded answers** (show the evidence) and **explicit refusals** (say when you
   can't, don't guess).
5. Ships with an **automated evaluation suite** that runs in CI so quality can't silently
   regress.

Everything below is in service of those five points.

---

## 3. The one big idea: "the model proposes, code decides"

### The analogy

Think of a **restaurant**. You (the customer) speak in free-form English: _"something warm,
not too spicy, no peanuts."_ The **waiter** (the AI model) listens and fills in a **standard
order ticket** with tick-boxes: dish = _soup_, spice = _mild_, allergen-free = _peanuts_. The
**kitchen** (our code) only ever reads the ticket. The kitchen never hears you directly. If
the waiter writes something that isn't on the menu, or scribbles a note in the margin, the
kitchen rejects the whole ticket rather than guessing.

### Why this matters

If you let an AI model write database queries or code directly, then a cleverly-worded
question ("prompt injection") can make it do things it shouldn't — read another team's data,
run an expensive operation, ignore your access rules. By forcing the model to fill in a
**fixed form** and having that form **strictly validated**, the worst a malicious question can
do is produce _a different valid form_ or _a refusal_. It can't reach anything.

### The form (we call it the "Query IR")

`IR` = "intermediate representation" — a structured object that sits between the sentence and
the answer. Ours looks like this:

```json
{
  "version": 1,
  "metric": "headcount",
  "filters": { "jobFamily": "Engineering" },
  "groupBy": "band"
}
```

- **`metric`** — one of exactly five: `hire_count`, `open_reqs`, `headcount`,
  `avg_time_to_fill`, `headcount_by_band`. The model can't invent a sixth.
- **`filters`** — optional `jobFamily`, `band`, `dateRange`. Again, fixed list of allowed values.
- **`groupBy`** — optional: `band` or `jobFamily`.

The model's reply is checked against this shape with **Zod** (see below). We use
`z.strictObject`, which means **any extra key fails the check**. If the model returns
`{ "metric": "headcount", "$where": "1=1" }`, the extra `$where` makes the entire thing
invalid, and we treat it as a refusal. We never "clean it up and carry on".

The model is also allowed to return a **refusal** instead of a form:
`{ "refusal": true, "reason": "out_of_scope", "message": "..." }`. That's a first-class,
expected outcome, not an error.

---

## 4. The technology stack — what, why, and what we skipped

For each tool: **what it is** (plain), **why it's here**, **what else we considered**.

### 4.1 Next.js 16 (App Router) — the web framework

- **What it is:** a framework for building websites in React that also lets you write
  backend API endpoints in the same project.
- **Why it's here:** we needed both a UI (the chat screen) and a small API (`POST /api/ask`).
  Next.js gives us both with one toolchain, one language, one deploy story. The API route and
  the UI share TypeScript types, so the shape of a response can't drift between server and
  client.
- **What we considered instead:**
  - _Plain React + a separate Express/Fastify server_ — two projects, two configs, type
    duplication. More moving parts for no benefit at this size.
  - _Remix / SvelteKit / Astro_ — all fine, but React + Next is the most conventional choice a
    reviewer will recognise instantly, and the assessment isn't about framework exotica.
  - _A pure backend with no framework_ — we still need a UI to demo role-switching and charts.

### 4.2 TypeScript (strict mode) — the language

- **What it is:** JavaScript with types. You declare "this value is a number" and the compiler
  catches you if you treat it as a string.
- **Why it's here:** the whole design leans on **shapes of data** being exactly right (the
  Query IR, the response, the session). Types make those shapes enforceable at build time, not
  just hoped-for at run time. We turned on the strictest settings, including
  `noUncheckedIndexedAccess` (accessing `array[0]` gives you `T | undefined`, forcing you to
  handle the empty case).
- **What we considered instead:** plain JavaScript with runtime checks only. We _do_ have
  runtime checks (Zod), but types catch a whole class of mistakes earlier and for free.

### 4.3 Zod 4 — the runtime validator / the contract

- **What it is:** a library for describing the shape of data and checking unknown values
  against it at run time. `z.strictObject({ metric: z.enum([...]) })` etc.
- **Why it's here:** this is the **load-bearing** dependency. It is the single checkpoint
  between the untrusted model output and everything else. One function,
  `interpretLlmProposal(raw)`, runs `LlmProposalSchema.safeParse(raw)` and returns one of
  `query_ir` / `refusal` / `invalid`. The request body and the API response are _also_ Zod
  schemas, so a malformed response is caught in tests and never shipped.
- **What we considered instead:**
  - _Hand-written `if` checks_ — verbose, easy to miss a case, and no single source of truth
    for the shape.
  - _JSON Schema + Ajv_ — works, but Zod gives us the TypeScript type _and_ the validator from
    one definition, so they can never disagree.
  - _class-validator / io-ts / yup_ — Zod is the current common choice, has the best
    TypeScript inference, and `z.strictObject` gives us the "reject unknown keys" behaviour we
    specifically need.

### 4.4 The OpenAI SDK (`openai` v7) — the real model client

- **What it is:** the official library for calling OpenAI's API.
- **Why it's here:** for the "real model" mode. We call it with `temperature: 0` (as
  deterministic as possible) and `response_format: json_object` (the API guarantees valid
  JSON back). The system prompt comes from a **prompt registry** keyed by a stable id
  (`propose-query-ir@v1`) — prompts are never written inline in the calling code, so they can
  be versioned and reviewed.
- **What we considered instead:** calling the HTTP API by hand with `fetch` (more code, no
  types), or a multi-provider abstraction like LangChain (heavy, and §4 of the brief put that
  out of scope). We built a tiny 1-method interface instead (next point).

### 4.5 Our own `LLMProvider` interface — the swappable seam

- **What it is:** a TypeScript interface with a single method:
  `proposeQueryIR(question: string): Promise<unknown>`. Two implementations:
  - **`MockProvider`** — no network, no key. A set of regular-expression rules that map common
    phrasings to a Query IR (or a refusal). Deterministic: the same question always produces
    the same output.
  - **`OpenAIProvider`** — the real thing.
- **Why it's here:** three reasons. (1) The app runs with **zero setup** — no API key needed
  to demo it. (2) The **eval suite and unit tests are deterministic and free** — they pin the
  `MockProvider`, so they never flake and never cost money. (3) Tests can feed the boundary a
  _deliberately broken_ proposal to prove the validation rejects it.
- **The factory:** `getLlmProvider(env)` — if `OPENAI_API_KEY` is set, you get the real
  provider; otherwise the mock. Nothing else in the codebase imports a provider class
  directly.

### 4.6 The deterministic executor — plain TypeScript, no AI

- **What it is:** `execute(queryIR, session)` — ordinary code that reads an in-memory array of
  records and computes a number. No library. It:
  1. applies **role scoping first** (`scopeFilters`),
  2. rejects filters a metric can't honour,
  3. computes the answer and records **exactly which row ids and fields** it used,
  4. returns a distinct "no rows matched" failure that is _not_ the number zero.
- **Why it's here:** this is the "kitchen". Because it's plain code over plain data, it can't
  be prompt-injected, can't run arbitrary queries, and is trivial to unit-test.
- **What we considered instead:** letting the model produce SQL and running it against
  SQLite. That's the exact thing the brief's "hard wall" is meant to prevent — one bad query
  and scoping is gone.

### 4.7 The dataset — committed JSON fixtures

- **What it is:** five JSON files (`job-families`, `bands`, `employees`, `jobs`, `users`)
  under `src/lib/data/fixtures/`. They're generated by `pnpm seed`, which runs a
  **seeded random-number generator** (same seed → same data every time) and validates the
  result against `DatasetSchema`. At app startup, `loader.ts` re-validates them and **refuses
  to start** if anything is malformed.
- **Why it's here:** stable, realistic-looking numbers with no database to install. The
  numbers are the same on every machine, so the eval suite can assert exact expected values.
- **What we considered instead:** a real database (Postgres/SQLite). That's what the `main`
  branch does — but it needs setup, and the brief wants a clean-clone run.

### 4.8 Vitest — the test runner

- **What it is:** a fast test runner, like Jest but built for the Vite/modern-ESM world.
- **Why it's here:** it runs the unit tests **and** the 18-case eval suite (the eval is just a
  test file that shares the same runner). One command, `pnpm test`, is the CI gate.
- **What we considered instead:** Jest (slower to configure with modern ESM/TypeScript here),
  node:test (barebones). Vitest is the least-friction choice for a Vite-adjacent stack.

### 4.9 Tailwind CSS v4 + shadcn/ui + Radix — the UI layer

- **What they are:** Tailwind is utility CSS classes (`flex`, `gap-2`, `text-sm`). Radix is a
  set of unstyled, accessible UI primitives (dropdowns, dialogs). shadcn/ui is a way of
  **copying** pre-built components (built on Radix + Tailwind) _into your repo_ so you own the
  code.
- **Why they're here:** we needed a polished dark, teal-accented product UI — a Claude-style
  chat workspace, a role switcher, charts — quickly, without a heavyweight component library
  we can't customise.
- **What we considered instead:** Material UI / Chakra / Ant (opinionated look, hard to make
  it _not_ look like them), or hand-rolling everything (slow). shadcn hits the middle: you get
  a starting point and full control.
- **Supporting cast:** `next-themes` (dark mode), `recharts` (the charts),
  `@untitled-ui/icons-react` and a vendored subset of `lucide-react` (icons), `sonner`
  (toasts), `class-variance-authority` + `tailwind-merge` + `clsx` (the `cn()` helper that
  merges class names).

### 4.10 pnpm — the package manager

- **What it is:** an npm alternative that's faster and uses far less disk by hard-linking
  shared packages.
- **Why it's here:** speed, and its stricter dependency resolution catches "you're using a
  package you didn't declare" bugs. Version is pinned via `packageManager` in `package.json`
  and Corepack.
- **What we considered instead:** npm (fine, slower, looser), yarn (fewer people default to it
  now).

### 4.11 (On `main` only) NextAuth v5, Prisma 7, PostgreSQL

The `main` branch turns the demo into a real multi-tenant product:

- **NextAuth v5** — email/password login with JWT sessions (no session table needed).
- **Prisma 7** — the tool that talks to the database with types. On signup it creates a user,
  an organisation, an OWNER membership, and **seeds that org's own dataset** in one
  transaction.
- **PostgreSQL** — the database, via Supabase's pooler in the hosted setup.
- **RBAC** — 7 named permissions, a role→permissions map, a `can(role, permission)` check.
  Permissions are **never** checked by role name directly.

Why keep this on a separate branch? Because the brief wants a zero-setup clone-and-run, and a
database breaks that. Two branches let both be true at once. `assessment-core` is the graded
submission; `main` shows where it goes next.

---

## 5. How a single request flows, with a real example

You're signed in as **Riley Chen**, a recruiter scoped to **Engineering**. You type:

> "how many people work in Sales?"

1. **Browser → API.** The chat screen sends `POST /api/ask` with
   `{ "userId": "recruiter_eng", "question": "how many people work in Sales?" }`. Note it does
   **not** send the role or the scope — only who's asking and what.

2. **`resolveSession("recruiter_eng")`.** The server looks up that id in the trusted user list
   and builds a `Session`: `{ role: "recruiter", jobFamilyName: "Engineering" }`. This is the
   **only** place role and scope come from. If the id is unknown, the request is refused here.

3. **The model proposes.** The provider is asked to turn the sentence into a Query IR. It
   returns (roughly): `{ version: 1, metric: "headcount", filters: { jobFamily: "Sales" } }`.

4. **The choke point.** `interpretLlmProposal(raw)` runs `safeParse`. The shape is valid, so
   we get `{ kind: "query_ir", queryIR: {...} }`. (If it were malformed, or had an extra key,
   or the model returned a refusal object, we'd branch to a refusal here — with the stage
   recorded as `schema_validation` or `model_refusal`.)

5. **`execute(queryIR, session)` — scoping first.** The very first line is
   `scopeFilters(queryIR.filters, session)`. Because the session is a recruiter,
   `jobFamily` is **forced to `"Engineering"`**, overwriting the `"Sales"` the model put
   there. Not rejected — _silently narrowed_.

6. **Compute + cite.** The executor counts active employees in Engineering, and records the
   row ids and the fields it read (`active`, `jobFamilyId`).

7. **Shape the response.** `toAnsweredResponse` builds the chart-ready payload and the summary
   string. The whole thing is run through `AskResponseSchema.parse` before it leaves — a
   malformed response would throw here and be caught by tests.

8. **Browser renders.** "Headcount — Engineering: 10", a KPI tile, and "Grounded in 10
   records · fields: active, jobFamilyId · show records".

**The point:** Riley asked about Sales and got Engineering's number, with no error and no
leak. The scoping happened in step 5, in plain code, regardless of how the question was
phrased.

Every request also writes one structured log line (`event: "ask"`) with the request id, who
asked, their resolved role and scope, what the model proposed, the outcome, and how long it
took — so the security boundary's decision is auditable, not just implied.

---

## 6. The security boundary, on its own

This is the part reviewers care about most, so here it is in isolation.

- **Where:** `scopeFilters(filters, session)` in `src/lib/executor/scope.ts`. Called as the
  first step of `execute()`, on **every** query.
- **CHRO:** filters pass through untouched (org-wide).
- **Recruiter:** `filters.jobFamily` is **overwritten** with their own family. Whatever the
  model asked for is discarded.
- **We do not reject** a cross-team question. We narrow it and let the (possibly empty) result
  stand. Asking "headcount in Sales" as an Engineering recruiter returns Engineering's
  headcount — the response's `appliedFilters.jobFamily` says `"Engineering"`, so the UI can
  show what actually happened.
- **It's idempotent:** running it twice gives the same result, which lets the eval suite
  re-run it when independently checking expected numbers.
- **The type system helps:** `Session` is a _discriminated union_ —
  `{ role: "chro" } | { role: "recruiter"; jobFamilyName: string }`. It is impossible to have
  a recruiter with no job family, or read `jobFamilyName` off a CHRO, without the compiler
  complaining.

Common question: _"why not just reject out-of-scope questions?"_ Because a recruiter
legitimately might ask a broad question ("how's hiring going?") and the useful answer is
"here's your area". Silently scoping is friendlier and still completely safe. Four eval cases
pin this behaviour.

---

## 7. Refusals — three kinds, and why "0" is not an answer

An answer is refused at one of three **stages**, and the response says which:

| Stage               | Means                                                                                | Example question                          |
| ------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| `model_refusal`     | the model itself declined — off-topic, ambiguous, or asks for a metric we don't have | "what's the weather in Berlin?"           |
| `schema_validation` | the model's JSON didn't match the Query IR shape                                     | (model returns SQL, or an extra key)      |
| `executor`          | valid query, but **zero rows matched**, or a filter the metric can't use             | "hires in Design in Q1 2024" (none exist) |

**"Zero rows" is deliberately not the number 0.** If you ask "how many hires in Design in Q1
2024" and there were none, "0" would be misleading — it looks like a real measurement. Instead
the executor returns a _failure_ (`no_matching_records`) and the UI says "nothing matched".
"We made 0 hires" and "there is no data for that slice" are different facts.

---

## 8. How we know it works — the eval suite

`src/lib/eval-runner/eval-set.json` holds **18 cases** in three buckets:

- **Golden answers** — a question, the expected metric, and the expected value, checked
  against the deterministic dataset.
- **Scoping** — recruiter principals asking in- and out-of-scope, asserting the resolved
  scope and value.
- **Refusals** — asserting the _stage and reason_, not just "it refused".

The runner is shared between `pnpm eval` (a readable console report) and `tests/eval.test.ts`
(the CI gate) — **the same code path**, so a green `pnpm test` guarantees a green eval. It
runs on the `MockProvider`, so it's deterministic and costs nothing. CI runs
`format:check → lint → typecheck → test → eval → build` on every push with no secrets.

We also QA'd both branches by hand against a running server (18 checks each, all green):
golden answers, the out-of-scope confinement, every refusal stage, request validation, and
citation integrity.

---

## 9. Why there are two branches

|                     | `assessment-core` (default)                                       | `main`                                   |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| **Purpose**         | the graded take-home                                              | where the product goes next              |
| **Setup**           | `pnpm install && pnpm dev`                                        | needs PostgreSQL + `.env`                |
| **Identity**        | 3 demo roles via an in-UI switcher                                | real email/password accounts             |
| **Data**            | committed JSON fixtures                                           | per-organisation seeded DB rows          |
| **Access control**  | `scopeFilters` (CHRO / recruiter)                                 | full RBAC: 7 permissions, roles, members |
| **The graded core** | _identical in both_ — query-IR, executor, scoping, pipeline, eval | _identical in both_                      |

The core engine is byte-for-byte the same logic on both branches. `main` only _wraps_ it in
auth, a database, and a bigger UI. The GitHub default branch is `assessment-core` so a plain
`git clone` runs with no setup.

---

## 10. Problems we hit, and how we fixed them

Real issues from the build, in plain terms.

### 10.1 Styles randomly broke while developing

**Symptom:** after adding a new Tailwind class during `pnpm dev`, the page would render
unstyled or half-styled until a full restart. **Cause:** Next 16's default dev bundler
(Turbopack) doesn't reliably re-scan for _newly-added_ Tailwind v4 classes on hot-reload — the
class silently produced no CSS. **Fix:** pin the dev script to `next dev --webpack`. The
production build was always fine (this was dev-only). We also gave the one element that must
never lose its styling — the sidebar's collapse tab — **inline styles** so no bundler can
drop it.

### 10.2 Some Tailwind classes produced no CSS even in a clean build

**Symptom:** `lg:grid-cols-[1fr_1.6fr]` and `[animation-delay:200ms]` just did nothing.
**Cause:** certain Tailwind v4 arbitrary-value forms don't emit a rule. **Fix:** use a
12-column grid with explicit spans instead of arbitrary fractions, and set
`style={{ animationDelay: "200ms" }}` inline instead of an arbitrary utility.

### 10.3 The chat answer landed in a brand-new chat

**Symptom:** you'd ask a question, and the answer would appear in a _different_, newly-created
chat, leaving an empty "New chat" row behind. **Cause:** the function that appends a turn
captured a stale `activeId` from the render that started the request. **Fix:** track the
active conversation id in a `ref` (updated synchronously) so an in-flight request always
writes back to the conversation its question created.

### 10.4 Switching demo roles kept the same chat history

**Symptom:** switch from CHRO to a recruiter and you'd still see CHRO's chats. **Cause:** the
history store kept one flat list. **Fix:** tag every conversation with its `userId`, filter
the visible list by the active principal, and clear the active chat on switch. Each person's
chats now stay separate in storage. Covered by a new test.

### 10.5 Reloading `/app` flashed the empty state

**Symptom:** on reload, the screen briefly showed "no chats / ask a question" before the saved
conversation appeared. **Cause:** the UI rendered before `localStorage` had been read.
**Fix:** expose a `hydrated` flag from the store; the chat and the sidebar show a short
skeleton until the first read finishes — the same trick Claude's own UI uses. (Considered
lazy-loading; it would have made the gap _longer_.)

### 10.6 The sidebar collapse tab kept drifting to the top

**Symptom:** the little pull-tab that collapses the sidebar wouldn't stay vertically centred.
**Cause:** `top: 50%` needs a parent with a resolved height, which it didn't reliably have.
**Fix, after several tries:** position it with `position: fixed` and **all** positioning in
inline styles, immune to any missing utility class.

### 10.7 (`main`) Prisma 7 changed how you connect

**Symptom:** the old way of passing a database URL to Prisma stopped working. **Cause:**
Prisma 7 removed constructor URL options; connection now goes through a "driver adapter" and a
`prisma.config.ts` file. **Fix:** use `@prisma/adapter-pg`, move URLs into `prisma.config.ts`,
and construct the client lazily behind a `Proxy` so importing it for a _type_ (or in a
DB-free test) doesn't require a live database.

### 10.8 (`main`) The signup seed transaction timed out

**Symptom:** creating an account against the hosted database timed out. **Cause:** inserting
rows one-by-one to a remote region blew the default 5-second transaction limit. **Fix:**
pre-assign ids and do four bulk `createMany` calls inside a 20-second transaction.

### 10.9 Lint rules fought the vendored UI components

**Symptom:** shadcn's copied-in components tripped React lint rules we didn't want to change.
**Fix:** add `src/components/ui/**` and `src/hooks/**` to the ESLint ignore list (that code is
upstream's, not ours to police), and allow `_`-prefixed unused args.

### 10.10 Docs drifted from the code

**Symptom:** the README's diagrams described function names from the `main` branch
(`resolveScope`, `execute(ir, ctx, data)`) that don't exist on `assessment-core` (which uses
`scopeFilters`, `execute(ir, session)`). **Fix:** corrected the diagram labels to match the
branch's actual API. (Noted here because "keep docs true to the code" is itself a lesson.)

---

## 11. Interview questions & answers

Grouped by theme. Each answer is short and plain; expand with the sections above.

### Architecture & design

**Q: Give me the 30-second overview.**
A user asks a question in English. One LLM call converts it to a small structured object (the
"Query IR"). That object is strictly validated. If it's valid, deterministic TypeScript
applies role-based scoping, computes the answer from an in-memory dataset, and returns it with
the exact records it used. If anything is off — bad shape, off-topic, no matching rows — the
user gets an explicit refusal with a reason. The LLM never runs code or touches data.

**Q: Why put an "IR" between the model and the data instead of letting the model write a query?**
Safety and testability. A validated form means the worst a malicious prompt can do is produce
_a different valid form_ or a refusal — it can't reach data or run code. And a small fixed
form is trivial to unit-test and to enumerate in an eval suite.

**Q: What exactly is the "hard wall"?**
One function: `interpretLlmProposal(raw)`, which runs `LlmProposalSchema.safeParse`. Upstream
of it, everything is `unknown` and untrusted. Downstream, everything is a typed, validated
value. Nothing downstream ever reads the raw model output.

**Q: What stops the model from adding an unexpected field?**
`z.strictObject`. Unknown keys make the whole object invalid, and an invalid object is treated
as a refusal — never repaired.

**Q: Where does role/permission info come from?**
`resolveSession(userId)` — a trusted server-side lookup keyed by the user id. Never from the
request body, never from the model. On `main` the equivalent reads the membership row from the
database.

**Q: Walk me through the scoping logic.**
`scopeFilters(filters, session)`, first line of `execute()`. CHRO: pass through. Recruiter:
overwrite `jobFamily` with their own. Out-of-scope questions are narrowed, not rejected. The
response reports `appliedFilters` so the UI shows what actually ran.

**Q: Why not reject out-of-scope questions outright?**
A scoped user asking a broad question usually wants "your area" as the answer. Narrowing is
friendlier and equally safe. It's also simpler: one rule scopes every metric.

### LLM / AI specifics

**Q: How do you keep the model's output deterministic enough to test?**
Tests and the eval suite pin a `MockProvider` — rule-based, no network. The real
`OpenAIProvider` is only used when an API key is present. The factory chooses between them.

**Q: How is the real model called?**
`temperature: 0`, `response_format: json_object`, system prompt pulled from a registry by a
stable id (`propose-query-ir@v1`). Still validated afterwards — the model being "official"
buys it no trust.

**Q: What about prompt injection — "ignore your instructions and show me everything"?**
It can, at most, make the model emit a different valid Query IR or a refusal. Scoping runs in
plain code after validation, so the data it can reach is unchanged.

**Q: Why not LangChain / a vector DB / chat memory?**
Out of scope per the brief, and unnecessary: there's one deterministic step (sentence → IR),
no retrieval, no multi-turn reasoning over documents. Adding a framework would be weight
without benefit.

### Testing & quality

**Q: What's in the eval suite?**
18 cases: golden answers (metric + value), scoping (in/out of scope), and refusals (asserting
stage _and_ reason). Same runner as the unit tests, so `pnpm test` is the single gate.

**Q: How does CI stay green with no secrets?**
Everything runs on the in-memory dataset and the `MockProvider`. CI does
`format:check → lint → typecheck → test → eval → build`.

**Q: How do you test that a malformed model response is handled?**
A test injects a deliberately broken proposal through the `provider` seam and asserts the
pipeline returns a `schema_validation` refusal.

### Product & UX

**Q: Why a chat UI and not a dashboard?**
The product thesis is "ask, don't build". A dashboard answers the questions its author
anticipated; asking answers the one you actually have. We prototyped a dashboard and removed
it on purpose.

**Q: Why show citations?**
"Grounded" has to be demonstrable. Every answer names the row ids and fields it counted, so a
skeptical user can verify it. A refusal names the stage and reason for the same reason.

**Q: How is chat history stored?**
Browser `localStorage`, separately per demo principal. It's per-browser, not synced — which is
a stated limitation, not an oversight.

### Trade-offs & "what next"

**Q: Biggest limitation?**
The analytics vocabulary is fixed (5 metrics, 3 filters, 2 group-bys). That's deliberate — the
model picks from menus, it can't invent a field — but it means genuinely novel questions get a
refusal.

**Q: No time dimension?**
`hire_count` takes a date range, but the model can't ask for "hires by month". A
`groupBy: "month"` plus a timeseries chart is the natural next addition.

**Q: What would you build with two more weeks?**
(1) An "Explore" mode — pick a metric and a breakdown, get the view plus the underlying rows,
through the same executor. (2) A time dimension in the IR. (3) Streaming the pipeline so the
proposed IR is visible as "here's what I understood". (4) On `main`: invitation emails, org
switching, an audit log of every query, rate limiting.

**Q: Why two branches instead of one?**
The brief wants a clean-clone run with no database. A real product wants auth and a database.
Two branches let both be true; the core logic is identical in each.

**Q: If you had to ship just one, which?**
`assessment-core`. It's the thing the brief asked for, it runs anywhere, and it contains the
entire interesting part — the boundary, the scoping, the refusals, the eval.

---

## Glossary

| Term                                 | Plain meaning                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **App Router**                       | The current Next.js way of organising pages and API routes by folder.                                             |
| **CI** (Continuous Integration)      | A robot that runs your checks (lint, tests, build) on every push.                                                 |
| **Citation**                         | The list of exact record ids and fields an answer was computed from.                                              |
| **Deterministic**                    | Same input → same output, every time. No randomness, no network.                                                  |
| **Discriminated union**              | A type that is "one of these shapes", tagged by a field (here, `role`), so the compiler knows which fields exist. |
| **Eval suite**                       | A fixed set of question→expected-answer cases used to measure quality.                                            |
| **Fixture**                          | A committed file of sample data used instead of a live database.                                                  |
| **Hydration**                        | The moment a server-rendered page "wakes up" in the browser and its JavaScript takes over.                        |
| **Idempotent**                       | Doing it twice changes nothing beyond doing it once.                                                              |
| **IR** (Intermediate Representation) | A structured object that sits between the raw input and the final action — here, the validated query form.        |
| **JWT**                              | A signed token that proves who you are without the server storing a session.                                      |
| **`localStorage`**                   | A small key-value store in the browser that survives page reloads.                                                |
| **Metric**                           | One of the five things we can measure: hire count, open reqs, headcount, avg time to fill, headcount by band.     |
| **Multi-tenancy**                    | One app instance serving many separate organisations whose data never mixes.                                      |
| **Prompt injection**                 | A user input crafted to make an LLM ignore its instructions.                                                      |
| **Prompt registry**                  | Prompts stored by a stable id instead of written inline, so they can be versioned.                                |
| **RBAC** (Role-Based Access Control) | Permissions attached to roles; you check the permission, not the role name.                                       |
| **Scoping**                          | Restricting what data a user can see based on their role (here, to one job family).                               |
| **Seed**                             | A starting number for a random generator; the same seed reproduces the same "random" data.                        |
| **`strictObject`**                   | A Zod object that rejects any key it wasn't told about.                                                           |
| **`temperature: 0`**                 | The setting that makes an LLM's output as repeatable as possible.                                                 |
| **Turbopack / webpack**              | Two bundlers (tools that package your code for the browser). We use webpack in dev to avoid a Tailwind bug.       |
| **Zod**                              | The library we use to describe and check the shape of data at run time.                                           |
