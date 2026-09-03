# Ask Your Hiring Data

A read-only, natural-language analytics assistant over a synthetic hiring dataset.

A user asks a plain-English question. One LLM call turns it into a small, **schema-validated
query IR** — a structured object, never SQL and never free-form code. A deterministic executor
(plain TypeScript, no AI) validates that object, applies **server-side role scoping** based on
who is logged in, computes the answer directly from the seeded dataset, and returns a grounded,
chart-ready result with citations. Out-of-scope, ambiguous, or no-match questions get an explicit
refusal instead of a fabricated answer.

> **The load-bearing decision:** the LLM is only ever allowed to _propose_ a structured object.
> It never executes anything. A separate, deterministic function is the only code path that
> touches the dataset, and role scoping is enforced there — not in the prompt.

## Status

Under construction, built in the order below. This README's _Getting started_ section is kept
accurate at every step; deeper architecture notes and `PROCESS.md` land with the final pass.

1. Query IR + refusal Zod schemas
2. Seed-data generator + fixtures + loader
3. Deterministic executor + role scoping
4. LLM provider interface + MockProvider + prompt registry
5. Shared ask-pipeline
6. API routes (`POST /api/ask`, `GET /api/users`)
7. Eval set + eval runner + CI gate
8. Chat UI + chart rendering + role switcher
9. Real `OpenAIProvider` (auto-selected when `OPENAI_API_KEY` is set)
10. CI workflow + docs + polish

## Prerequisites

- **Node.js `>=20.9`** (repo is developed on Node 24 — see [`.nvmrc`](.nvmrc)).
- **pnpm** via Corepack: `corepack enable pnpm` (the repo pins its version in `package.json`).
- No LLM API key required. The app, tests, and eval suite all run on a deterministic
  `MockProvider` by default.

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

### Optional: real OpenAI-backed provider

```bash
cp .env.example .env.local
# edit .env.local and set OPENAI_API_KEY=...
```

The provider factory picks up the key automatically; nothing else changes. `.env.local` is
git-ignored.

## Scripts

| Command                             | What it does                                            |
| ----------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                          | Run the app in development mode                         |
| `pnpm build`                        | Production build                                        |
| `pnpm start`                        | Serve the production build                              |
| `pnpm lint`                         | ESLint                                                  |
| `pnpm format` / `pnpm format:check` | Prettier write / check                                  |
| `pnpm typecheck`                    | `next typegen` + `tsc --noEmit`                         |
| `pnpm test`                         | Vitest (unit tests + the eval suite as a CI gate)       |
| `pnpm test:watch`                   | Vitest in watch mode                                    |
| `pnpm seed`                         | Regenerate the synthetic dataset fixtures               |
| `pnpm eval`                         | Run the Q&A eval suite with a readable pass/fail report |

## License

MIT — see [LICENSE](LICENSE).
