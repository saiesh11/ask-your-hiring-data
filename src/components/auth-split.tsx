import Link from "next/link";
import type { ReactNode } from "react";
import { SparkIcon } from "@/components/icons";

const ROLES = ["OWNER", "ADMIN", "CHRO", "RECRUITER", "VIEWER"];

const VALUE = [
  "Cites the exact records and fields behind every answer",
  "Role-scoped server-side — a recruiter sees their families",
  "Read-only. The model proposes a query; code decides",
];

/**
 * Split auth screen: the form on the left, a value panel on the right that
 * explains the product before someone is inside it. The panel drops away on
 * narrow screens so the form stands alone.
 */
export function AuthSplit({ mode, children }: { mode: "login" | "signup"; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link
          href="/"
          className="font-mono text-xs tracking-wide text-muted-foreground hover:text-foreground"
        >
          ask your hiring data
        </Link>
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">{children}</div>
        </div>
      </div>

      <aside className="hidden flex-col justify-between bg-muted/40 px-10 py-10 lg:flex">
        <span className="grid size-10 place-items-center rounded-xl border bg-card text-primary">
          <SparkIcon className="size-5" />
        </span>
        <div className="max-w-md">
          <p className="text-lg font-medium text-balance">
            Grounded, role-scoped answers over your hiring data.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
            {VALUE.map((v) => (
              <li key={v} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {v}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <span
                key={r}
                className="rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide"
              >
                {r}
              </span>
            ))}
          </div>
          <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">
            {mode === "signup"
              ? "We generate a demo hiring dataset for your workspace the moment you land."
              : "Synthetic data only — no integration with any real HR system."}
          </p>
        </div>
      </aside>
    </main>
  );
}
