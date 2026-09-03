"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChatIcon,
  CloseIcon,
  MembersIcon,
  MoreIcon,
  NewChatIcon,
  RenameIcon,
  SelectorIcon,
  SparkIcon,
} from "@/components/icons";
import type { DemoUserPublic } from "@/lib/api";
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

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    hydrated,
    conversations,
    activeId,
    activeUserId,
    setActiveUserId,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  } = useChatStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [users, setUsers] = useState<DemoUserPublic[]>([]);
  const onChat = pathname === "/app";

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((b: { users?: DemoUserPublic[] }) => setUsers(b.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  const active = users.find((u) => u.id === activeUserId);

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
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarMenu>
            {!hydrated ? (
              <div className="flex flex-col gap-1 px-2 py-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-7 animate-pulse rounded-md bg-sidebar-accent" />
                ))}
              </div>
            ) : (
              conversations.length === 0 && (
                <p className="px-2 py-1 text-xs text-sidebar-foreground/60">No chats yet</p>
              )
            )}
            {hydrated &&
              conversations.map((c) => (
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
                        className="w-full rounded-md bg-sidebar-accent px-2 py-1 text-sm ring-1 ring-sidebar-ring outline-none"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <MembersIcon />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">
                      {active?.displayName ?? "Viewing as…"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {active ? active.scope : "pick a demo role"}
                    </span>
                  </div>
                  <SelectorIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-60">
                <DropdownMenuLabel className="font-normal">View the data as</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {users.map((u) => (
                  <DropdownMenuItem key={u.id} onClick={() => setActiveUserId(u.id)}>
                    <div className="grid leading-tight">
                      <span className="font-medium">{u.displayName}</span>
                      <span className="text-xs text-muted-foreground">{u.scope}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
