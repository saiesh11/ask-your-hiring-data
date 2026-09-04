# PROCESS

How this was built: the ambiguities and how they were resolved, what was scoped as must-ship vs.
deferred, the decisions that mattered most, what I'd do with more time, and how to run and trust
the tests.

## Assumptions

The brief describes a synthetic dataset and a "Recruiter / CHRO" role model but doesn't ship a
fixture file with this copy of the assessment, so:

- **The dataset is generated once, committed as JSON, and validated on load.** `pnpm seed`
  runs `buildDataset()` (a seeded PRNG in `src/lib/data/generate.ts`) and writes
  `src/lib/data/fixtures/*.json` — job families, bands, employees (hire date + `active`), job
  requisitions (posted / filled dates, `open` | `filled`), and the three demo users. At runtime
  `src/lib/data/loader.ts` imports those JSON files and runs `DatasetSchema.safeParse` — a
  malformed fixture is a hard startup failure. A fixed seed ⇒ identical data every run, which is
  what makes the golden-answer evals meaningful. If Exterview intended specific fixtures to be
  used verbatim, dropping them into `fixtures/` is the only change.
- **Three demo principals, no auth.** `chro` (org-wide), `recruiter_eng`, `recruiter_sales`
  (each confined to one job family). Selected in the UI; the API takes `userId` in the body and
  resolves the principal server-side. Real authentication is out of scope for the brief.
- **"Constrained to their own job requisitions" is read as "their job family."** The brief's
  phrasing is illustrative ("e.g. a Recruiter…"); the principle it's testing is _server-side,
  role-based data scoping_. Per-requisition ownership (an `ownerId` on job rows) was considered
  and set aside: it only maps to 2 of the 5 metrics — `open_reqs` and `avg_time_to_fill` are
  about requisitions, but `headcount`, `hire_count` and `headcount_by_band` are about
  **employees**, who don't belong to a req. Scoping recruiters by **job family** is the one unit
  that applies uniformly to every metric, so the boundary stays a single rule
  (`scopeFilters`) rather than a per-metric special case. Adding req ownership on top is a
  contained extension if the product later needs it.
- **A fixed analytics vocabulary is a feature.** Five metrics (`hire_count`, `open_reqs`,
  `headcount`, `avg_time_to_fill`, `headcount_by_band`), two group-by dimensions, three filters.
  The model picks from menus; it cannot name a field that doesn't exist. This shrinks the
  attack surface to "which valid IR did the model pick", which is exactly what the eval checks.
- **"Grounded" means record-level citations.** Every answer names the row ids and fields it
  counted. A refusal names the stage it came from and the reason.

## Must ship vs. deferred

**Shipped**

- Query IR + refusal Zod contract; the LLM's entire output surface is one `safeParse`.
- Deterministic executor with job-family scoping applied first, then metric computation, then
  citations; a distinct `no_matching_records` result for "valid query, zero rows".
- `LLMProvider` interface with a deterministic `MockProvider` and a real `OpenAIProvider`
  (auto-selected when `OPENAI_API_KEY` is set), plus a local prompt registry (`propose-query-ir@v1`).
- `runAskPipeline` and `POST /api/ask` — the caller's principal comes from the request-resolved
  `userId`, and the executor re-derives scope regardless of what the IR asked for.
- Chat UI with a role switcher, a chart per answer, the grounding line, and a records toggle.
- 18-case eval set + runner, wired into `pnpm test` and `pnpm eval`, gated in CI.

**Deferred**

- Real auth / multi-tenancy / a database. (Taken further on the `saas-model` branch as a hosted
  product; this branch is the version that matches the brief and runs from a clean clone.)
- A time dimension in the IR (`groupBy: "month"`, a `timeseries` chart kind) — `hire_count`
  takes a date range but can't be broken out by month yet.
- More metrics: attrition, offer-accept rate, funnel conversion, cohort retention.
- Streaming the pipeline so the proposed IR is visible in the UI as a "here's what I understood".

## Mini design notes

### IR schema — a closed vocabulary, not a generic query language

`QueryIRSchema` is `{ version: 1, metric, filters, groupBy? }`. Everything is `z.strictObject`,
so an unexpected key — an injected `$where`, a formula, a second metric — is a hard parse error,
not a silently-stripped field. The union with `RefusalSchema` is also strict, so a payload
satisfies at most one member. A generic `{ select, where, aggregate }` shape would have been
more "flexible" and much harder to reason about safely; a fixed metric menu means the executor's
job is a `switch`, not an interpreter.

### Role-scoping enforcement point — `scopeFilters`, before anything is computed

Scope is applied in exactly one place: `scopeFilters(queryIR.filters, session)` at the top of
`execute()`, before any row is touched. The `Session` (`{ role: "chro" }` or
`{ role: "recruiter", jobFamilyName }`) comes from `resolveSession(userId)` — resolved
server-side from the fixture, never from the request body and never from the model. CHRO:
filters pass through. Recruiter: `filters.jobFamily` is **forced** to their own family,
overriding whatever was asked. A scoped caller asking about another family is **silently
confined**, not rejected — asking "headcount in Sales" as an Engineering recruiter returns
Engineering's number, with `appliedFilters.jobFamily === "Engineering"` on the response. Four
eval cases pin this, including the silent-confinement one. The prompt is never told about roles.

### Refusal strategy — typed by where it originated

There are three refusal sources and the response says which: `model_refusal` (the model
returned a `Refusal` — off-topic, ambiguous, unsupported metric), `schema_validation` (its JSON
failed `LlmProposalSchema`), and `executor` (a valid query that no rows match, or a filter the
metric can't honor). A failed parse is treated as a refusal, never repaired. "Zero rows" is a
distinct outcome from "the answer is 0" — the executor returns a failure so the UI can say
"nothing matched" rather than show a misleading zero.

### Eval methodology — recompute, don't rubber-stamp

The 18 cases span golden answers, scoping (recruiter principals incl. out-of-scope), and
refusals (asserting stage + reason). Each case runs through the **exact** `runAskPipeline` the
API route uses, then — for answered cases — the runner independently recomputes the value by
calling `execute(ir, resolveSession(userId))` directly with the case's applied filters, and
asserts the two agree (plus optional literal anchors, and that the cited record set equals the
one the executor counted). A regression in the mock, the schema boundary, scoping, or
presentation fails a case; "the model emitted valid JSON" alone does not pass one. The runner is
shared between `pnpm eval` (console report) and `tests/eval.test.ts` (CI gate), and is pinned to
the `MockProvider` so the gate is deterministic and free.

## With two more weeks

1. **Time in the IR** — monthly `hire_count`, a `timeseries` payload, and a trend chart.
2. **Stream the pipeline** and surface the proposed IR in the UI ("here's what I understood"),
   so the boundary is visible to a user, not just in the logs.
3. **More metrics and an eval bucket per metric**, plus adversarial prompt-injection cases in
   the eval set (payloads that try to smuggle an extra key or a second query).
4. **Structured-log assertions** — snapshot the `logger.info("ask", …)` line per eval case so a
   logging regression is also caught.
5. Property-based tests for the executor (random valid IR + random dataset ⇒ invariants: scope
   never widens, citation count matches the row count).

## Running the tests and the eval suite

```bash
pnpm install
pnpm test        # Vitest — unit + the eval suite as a CI gate
pnpm eval        # the 18-case Q&A eval with a readable pass/fail report
pnpm lint
pnpm typecheck
pnpm build
```

No API key or network is required — everything runs on the `MockProvider` and the in-memory
dataset. With `OPENAI_API_KEY` set, the app and a separate contract test use the real
`OpenAIProvider`; the eval gate stays on the mock on purpose.

### What is intentionally not tested

- **No end-to-end browser test.** The chat flow is covered at the component level (Testing
  Library) and the API at the route-handler level; there's no Playwright run.
- **The real OpenAI call is a contract test against a fake client**, not a live-API test — a
  live call would make the suite non-deterministic and cost money on every run.
- **No load / concurrency testing.** The dataset is small by construction and the executor is
  pure and synchronous.
- **Structured logs are emitted but not asserted** (see "with two more weeks").
