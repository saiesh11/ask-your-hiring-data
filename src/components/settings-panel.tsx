"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageShell, SectionLabel } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsPanel(props: { name: string; slug: string; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(props.name);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const res = await fetch("/api/organization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Could not save.");
      return;
    }
    toast.success("Organization updated");
    router.refresh();
  }

  return (
    <PageShell title="Settings">
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-6 py-4">
          <SectionLabel>Organization</SectionLabel>
        </div>
        <form onSubmit={save} className="grid gap-7 p-6 sm:p-8">
          <div className="grid gap-2.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              className="h-11 max-w-md"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!props.canManage}
            />
          </div>
          <div className="grid gap-2.5">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              className="h-11 max-w-md font-mono text-sm"
              value={props.slug}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">Used in URLs. Can&apos;t be changed.</p>
          </div>
          {props.canManage && (
            <Button
              type="submit"
              size="lg"
              className="justify-self-start"
              disabled={pending || name.trim() === props.name}
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </form>
      </section>
    </PageShell>
  );
}
