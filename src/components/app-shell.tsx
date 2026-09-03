"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Viewer {
  name: string;
  email: string;
  orgName: string;
  role: string;
  scopeLabel: string;
  canManageMembers: boolean;
}

const NAV = [
  { href: "/app", label: "Assistant" },
  { href: "/app/members", label: "Members" },
  { href: "/app/settings", label: "Settings" },
];

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold">{viewer.orgName}</span>
            <nav className="flex gap-1">
              {NAV.map((item) => {
                const active =
                  item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                return (
                  <Button
                    key={item.href}
                    asChild
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                );
              })}
            </nav>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {viewer.name}
                <Badge variant="secondary" className="ml-2">
                  {viewer.role}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm">{viewer.email}</div>
                <div className="text-xs text-muted-foreground">Scope: {viewer.scopeLabel}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut({ redirectTo: "/" })}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4">{children}</main>
    </div>
  );
}
