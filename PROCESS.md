# PROCESS

Notes on how this was built: the assumptions, what shipped vs. what was deliberately left out,
the design decisions and why, the sharp edges of the toolchain, and what I'd do next.

## Context

The brief asked for a read-only natural-language analytics assistant with a hard boundary
between "the model proposes" and "code decides", server-side role scoping, grounded answers with
explicit refusals, and a CI-gated eval suite. Mid-way I was asked to **turn it into a SaaS
product** — real authentication, multi-tenancy, and a proper roles-and-permissions model — and
later to make the UI a polished dark, teal-accented product rather than a demo harness.

So this is two layers:

1. **The graded core** (steps 0–9 of the original plan): Query IR, deterministic executor +
   scoping, LLM provider abstraction, the ask pipeline, `/api/ask`, and the eval gate. This is
   preserved intact — branch `assessment-core`, tag `v0.1-assessment` — and its 18-case eval
   and unit tests stayed green through every subsequent change.
2. **The SaaS shell** added on top: NextAuth v5 credentials auth, a Prisma/Postgres data model,
   per-organization generated datasets seeded on signup, an RBAC layer, member management, and
   the redesigned chat workspace.

## Assumptions

- **Synthetic data only.** No integration with a real ATS/HRIS. Each org gets a deterministic
  dataset generated from a per-org seed at signup, so the numbers are stable and demoable.
- **A fixed analytics vocabulary is a feature, not a limitation.** Five metrics, two group-by
  dimensions, three filters. The model picks from menus; it cannot invent a field.
- **The recruiter/viewer job-family scope is the interesting RBAC case.** Org-wide roles
  (OWNER/ADMIN/CHRO) are the easy path; the scoped roles are where the security boundary earns
  its keep. The brief's "constrained to their own job requisitions" is read as **job family**:
  per-req ownership only maps to `open_reqs` and `avg_time_to_fill`, while `headcount` /
  `hire_count` are about employees, so job family is the one unit that scopes every metric with
  a single rule.
- **"Grounded" means record-level citations.** Every answer names the row ids and fields it
  counted; a refusal names the stage and reason.
- **Single active org per session.** A user can belong to multiple orgs (the schema supports
  it) but the app resolves the first membership. Org switching is deferred.

## Shipped

- Query IR + refusal Zod contract; deterministic executor with the scope boundary applied first.
- LLM provider interface, deterministic `MockProvider`, real `OpenAIProvider` (auto-selected
  when `OPENAI_API_KEY` is set), prompt registry.
- `runAskPipeline` and `POST /api/ask` (caller resolved from the session, never the body).
- 18-case eval suite, runnable as `pnpm eval` and as `tests/eval.test.ts`; CI gate.
- NextAuth v5 credentials auth (JWT sessions); signup creates user + org + OWNER membership +
  seeds the org's dataset in one transaction.
- Prisma/Postgres schema: users, orgs, memberships, invitations, job families, bands, employees,
  jobs. `PrismaHiringDataSource` maps an org's rows into the executor's shape.
- RBAC: 7 permissions, role→permission-set map, `can()` / `assertPermission()`, role-rank for
  "can assign", last-owner protection.
- Member management UI + API (invite, change role/scope, remove, revoke invitation), all
  permission-gated server-side.
- Redesigned product UI: dark-first, teal accent, Geist + Geist Mono (mono for every figure),
  Untitled UI icons; a Claude-style chat workspace (centred composer that drops to the bottom
  once a conversation starts, full-width scroll, renamable history), frosted-glass auth screens,
  a product-forward landing page.

## Deliberately deferred

- **A pre-built dashboard.** Prototyped, then removed on purpose — the product's thesis is that
  you _ask_ instead of reading a standing dashboard. An open-ended "Explore" mode (choose a
  metric and a breakdown, get the matching view alongside the underlying rows) is the right
  version of that idea and the natural next build.
- **A time dimension in the IR.** `hire_count` accepts a date range but the model can't ask for
  "hires by month". A `groupBy: "month"` and a `timeseries` chart kind is a contained addition.
- **Invitation email delivery.** Invitations are created with a token; there's no mailer, so the
  accept link is surfaced in the API response for the demo.
- **Org switching, org deletion UI, audit log, rate limiting, streaming responses.**
- **Animated marketing / auth pages.** The current landing and login are static; a motion pass
  is planned.

## Design decisions

### 1. The IR boundary — the model proposes, code decides

The LLM's entire surface is one `LlmProposalSchema.safeParse` call. The proposal is either a
`QueryIR` (`{ version, metric, filters, groupBy? }`) or a `Refusal` (`{ refusal: true, reason,
message }`). Both members are `z.strictObject`, so a value satisfies at most one and any extra
key — an injected `$where`, a formula, a stray field — is a hard parse failure. A failed parse
is **treated as a refusal**, never repaired or partially salvaged.

Nothing downstream of the parse trusts the model. The executor is plain TypeScript over an
in-memory array; it never builds a query string. This means prompt injection can, at worst,
make the model emit a differently-shaped valid IR or a refusal — it cannot reach data it
shouldn't, run code, or change scope.

### 2. RBAC + job-family scoping — one security boundary, server-side

Role lives on the `Membership` row. `requireContext()` (the single server entry point) reads it
from the DB — never from the request body, never from the LLM — and produces an
`ExecutionContext` that is either org-wide (`scope: null`) or a job-family list.

`resolveScope(context, ir.jobFamily)` in the executor is the **only** place scope is applied,
and it runs **before** any metric computation:

- Org-wide caller: no constraint; the IR's requested family passes through.
- Scoped caller asking _within_ their scope: narrowed to that one family.
- Scoped caller asking _outside_ their scope: silently confined to their whole scope — **never
  rejected, never widened**. Asking "headcount in Sales" as an Engineering recruiter returns
  Engineering's headcount with `scope: { jobFamilies: ["Engineering"] }` on the response, not an
  error. (Four eval cases pin this.)

Permissions are never checked by role name. `can(role, permission)` against a
`ROLE_PERMISSIONS` map is the only check; `assertPermission` throws a `ForbiddenError` the
routes turn into a 403.

### 3. Refusals are first-class, and typed by stage

Three places produce a refusal, and the response says which:

| Stage               | Example                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `model_refusal`     | off-topic, ambiguous, or asks for an unsupported metric                                        |
| `schema_validation` | the model's JSON failed `LlmProposalSchema`                                                    |
| `executor`          | valid query, **zero matching rows** (`no_matching_records`) or a filter the metric can't honor |

"Zero rows" is a distinct outcome from "answer is 0" — the executor returns a failure, not a
scalar, so the UI can say "nothing matched" instead of showing a misleading zero.

### 4. Eval methodology

`src/lib/eval-runner/eval-set.json` is 18 cases across three buckets: **golden answers** (metric
and value checked against the deterministic dataset), **scoping** (recruiter principals,
including the out-of-scope-silently-confined case), and **refusals** (asserting stage and reason,
not just "refused"). The runner is shared between `pnpm eval` (readable console report) and
`tests/eval.test.ts` (CI gate) — same code path, so a green `pnpm test` guarantees a green
eval. It runs on the `MockProvider`, so it's deterministic and free; the real provider is
exercised by a separate contract test.

### 5. Multi-tenancy and per-org seeding

Signup is one Prisma transaction: create the user (hashed password), the org (with a random
`dataSeed`), an OWNER membership, then `seedOrgHiringData` writes that org's job families,
bands, employees, and jobs generated from `dataSeed`. Because the generator is deterministic, an
org's data is reproducible and every org's numbers differ. `PrismaHiringDataSource(orgId)` is
constructed per request in `requireContext()` and only ever reads rows `where: { orgId }` — the
data source is physically incapable of returning another tenant's rows.

### 6. Auth

NextAuth v5 credentials provider, JWT sessions (no session table). Chosen over a hosted auth
service to keep the assessment self-contained — one `AUTH_SECRET`, no third-party dashboard.
The credentials `authorize()` uses `z.object` (not `z.strictObject`) on purpose: NextAuth passes
`csrfToken` / `callbackUrl` alongside the fields, and strict parsing rejected the whole sign-in.

## Toolchain sharp edges

- **Prisma 7** dropped `datasourceUrl` / `datasources` from the `PrismaClient` constructor — the
  connection now comes from a **driver adapter** (`@prisma/adapter-pg`). Connection URLs moved
  to `prisma.config.ts` (which loads `.env.local`). The `prisma-client` generator (not
  `prisma-client-js`) emits ESM TypeScript to `src/generated/prisma`, and `next.config.ts` needs
  `serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"]`. The client is
  constructed lazily behind a `Proxy` so importing the module for a type — or in a DB-free test
  — never needs `DATABASE_URL`.
- **`prisma generate` must work with no env** (clean clone, CI). `prisma.config.ts` reads
  `process.env.DIRECT_URL` directly rather than through a helper that throws when unset.
- **Next 16's `next dev` uses Turbopack**, which in this version does **not** reliably re-scan
  for newly-added Tailwind v4 utility classes on hot reload — new classes silently produced no
  CSS rule until a `.next` wipe and restart. `pnpm dev` is pinned to `next dev --webpack`;
  `build` (always correct) is unchanged. The one element that must never depend on a utility
  class the bundler might drop — the sidebar's collapse tab — is positioned with inline styles.
- **NextAuth pulls `next/server` into the module graph** in a way Vitest/Vite couldn't resolve.
  `src/lib/tenancy/context.ts` (which imports auth) is kept out of the `@/lib/tenancy` barrel;
  routes import `requireContext` / `guardOrgRoute` from their files directly, and tests mock
  `@/lib/tenancy/context`.
- **The Supabase seed transaction timed out** on the default 5s limit doing per-row inserts to a
  remote region — rewritten as pre-assigned ids + four `createMany` calls inside a 20s
  transaction.

## Not tested / known limits

- No end-to-end browser test. The auth flow (signup → session → `/api/ask` → 401 when
  unauthenticated) is verified over HTTP by hand and in gated integration tests; there's no
  Playwright.
- DB integration tests (`seedOrgHiringData`, member lifecycle, executor-parity between the
  in-memory and Prisma sources) are gated behind `RUN_DB_TESTS=1` and a real `DATABASE_URL` —
  they don't run in CI.
- `OpenAIProvider` has a contract test against a fake client, not a live-API test.
- The chat history store is `localStorage`-only (per browser, not synced, not server-persisted).
- No pagination anywhere; datasets are small by construction.

## With two more weeks

1. **Explore mode** — the "ask, don't dashboard" answer to wanting a dashboard: choose a metric
   and a breakdown, get the right visual plus the underlying rows, all through the same executor.
2. **Time in the IR** — `groupBy: "month"`, a `timeseries` chart kind, and hire-trend / req-aging
   as first-class answers.
3. **Streaming** the pipeline (IR proposal → executing → grounded answer) so the reasoning is
   visible, and showing the proposed IR in the UI as a "here's what I understood" affordance.
4. **Invitation emails**, org switching, an audit log of every analytics query (who asked what,
   what scope resolved, how many rows), and per-org rate limiting.
5. **A Playwright suite** covering signup → seed → ask → refuse → scope, and a GitHub Actions
   job that spins up Postgres and runs the `RUN_DB_TESTS=1` set.
