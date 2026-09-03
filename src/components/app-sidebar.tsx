"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChartIcon,
  ChatIcon,
  CloseIcon,
  MembersIcon,
  MoreIcon,
  NewChatIcon,
  OrgIcon,
  RenameIcon,
  SelectorIcon,
  SettingsIcon,
  SignOutIcon,
  SparkIcon,
} from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useChatStore } from "./chat-store";

export interface SidebarViewer {
  name: string;
  email: string;
  orgName: string;
  role: string;
}

export function AppSidebar({ viewer }: { viewer: SidebarViewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    conversations,
    activeId,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  } = useChatStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const onChat = pathname === "/app";

  function goNew() {
    newConversation();
    if (!onChat) router.push("/app");
  }
  function goSelect(id: string) {
    selectConversation(id);
    if (!onChat) router.push("/app");
  }
  function commitRename(id: string, value: string) {
    renameConversation(id, value);
    setRenamingId(null);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
          <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
            <SparkIcon className="size-3.5" />
          </span>
          <span className="font-mono text-xs tracking-wide">ask your hiring data</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={goNew}>
              <NewChatIcon />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/app/dashboard")}>
              <Link href="/app/dashboard">
                <BarChartIcon />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarMenu>
            {conversations.length === 0 && (
              <p className="px-2 py-1 text-xs text-sidebar-foreground/60">No chats yet</p>
            )}
            {conversations.map((c) => (
              <SidebarMenuItem key={c.id}>
                {renamingId === c.id ? (
                  <form
                    className="px-1 py-0.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitRename(c.id, new FormData(e.currentTarget).get("title") as string);
                    }}
                  >
                    <input
                      name="title"
                      autoFocus
                      defaultValue={c.title}
                      onBlur={(e) => commitRename(c.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full rounded-md bg-sidebar-accent px-2 py-1 text-sm outline-none ring-1 ring-sidebar-ring"
                    />
                  </form>
                ) : (
                  <>
                    <SidebarMenuButton
                      isActive={onChat && c.id === activeId}
                      onClick={() => goSelect(c.id)}
                    >
                      <ChatIcon />
                      <span className="truncate">{c.title}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover aria-label="Chat options">
                          <MoreIcon />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-40">
                        <DropdownMenuItem onClick={() => setRenamingId(c.id)}>
                          <RenameIcon />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => deleteConversation(c.id)}
                        >
                          <CloseIcon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/app/members")}>
              <Link href="/app/members">
                <MembersIcon />
                <span>Members</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/app/settings")}>
              <Link href="/app/settings">
                <SettingsIcon />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <OrgIcon />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{viewer.orgName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {viewer.name} · {viewer.role}
                    </span>
                  </div>
                  <SelectorIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate font-normal">
                  {viewer.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut({ redirectTo: "/" })}>
                  <SignOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
