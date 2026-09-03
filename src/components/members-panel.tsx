"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES = ["OWNER", "ADMIN", "CHRO", "RECRUITER", "VIEWER"] as const;
const SCOPED_ROLES = new Set(["RECRUITER", "VIEWER"]);

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  jobFamilyScope: string[];
  isSelf: boolean;
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  expired: boolean;
};
type JobFamily = { id: string; name: string };

export function MembersPanel(props: {
  initialMembers: Member[];
  initialInvitations: Invitation[];
  jobFamilies: JobFamily[];
  canManage: boolean;
  canManageRoles: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const familyName = new Map(props.jobFamilies.map((f) => [f.id, f.name]));

  async function call(url: string, init: RequestInit, okMessage: string) {
    const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Something went wrong.");
      return false;
    }
    toast.success(okMessage);
    router.refresh();
    return true;
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Members</h1>
        {props.canManage && <InviteDialog jobFamilies={props.jobFamilies} onInvite={call} />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead className="w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.initialMembers.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="font-medium">
                  {m.name}
                  {m.isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </TableCell>
              <TableCell>
                {props.canManageRoles && !m.isSelf ? (
                  <Select
                    value={m.role}
                    onValueChange={(role) =>
                      call(
                        `/api/members/${m.id}`,
                        { method: "PATCH", body: JSON.stringify({ role }) },
                        "Role updated",
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{m.role}</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {SCOPED_ROLES.has(m.role)
                  ? m.jobFamilyScope.map((id) => familyName.get(id) ?? id).join(", ") || "—"
                  : "org-wide"}
              </TableCell>
              <TableCell>
                {props.canRemove && !m.isSelf && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      call(`/api/members/${m.id}`, { method: "DELETE" }, "Member removed")
                    }
                  >
                    Remove
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {props.initialInvitations.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Pending invitations</h2>
          <Table>
            <TableBody>
              {props.initialInvitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    {inv.email}
                    <Badge variant="outline" className="ml-2">
                      {inv.role}
                    </Badge>
                    {inv.expired && <span className="ml-2 text-xs text-destructive">expired</span>}
                  </TableCell>
                  <TableCell className="w-[1%]">
                    {props.canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          call(
                            `/api/invitations/${inv.id}`,
                            { method: "DELETE" },
                            "Invitation revoked",
                          )
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function InviteDialog({
  jobFamilies,
  onInvite,
}: {
  jobFamilies: JobFamily[];
  onInvite: (url: string, init: RequestInit, ok: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("VIEWER");
  const [scope, setScope] = useState<string[]>([]);
  const scoped = SCOPED_ROLES.has(role);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const ok = await onInvite(
      "/api/members",
      {
        method: "POST",
        body: JSON.stringify({ email, role, jobFamilyScope: scoped ? scope : undefined }),
      },
      "Invitation sent",
    );
    if (ok) {
      setOpen(false);
      setEmail("");
      setScope([]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Invite member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scoped && (
            <div className="grid gap-2">
              <Label>Job families</Label>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {jobFamilies.map((f) => (
                  <label key={f.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scope.includes(f.id)}
                      onChange={(e) =>
                        setScope((s) =>
                          e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id),
                        )
                      }
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={scoped && scope.length === 0}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
