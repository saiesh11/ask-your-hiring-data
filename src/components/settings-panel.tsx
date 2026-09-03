"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="py-6">
      <h1 className="mb-4 text-lg font-semibold">Settings</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!props.canManage}
              />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input value={props.slug} disabled readOnly />
            </div>
            {props.canManage && (
              <Button type="submit" disabled={pending || name.trim() === props.name}>
                {pending ? "Saving…" : "Save"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
