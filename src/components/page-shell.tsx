import type { ReactNode } from "react";

/** Shared frame for the in-app secondary pages (Members, Settings). */
export function PageShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

/** Mono uppercase label that opens a section or a bordered panel. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  );
}
