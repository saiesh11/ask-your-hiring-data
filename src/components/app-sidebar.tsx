"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChatIcon,
  CloseIcon,
  MembersIcon,
  NewChatIcon,
  OrgIcon,
  SelectorIcon,
  SettingsIcon,
  SignOutIcon,
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
  SidebarRail,
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
  const { conversations, activeId, newConversation, selectConversation, deleteConversation } =
    useChatStore();
  const onChat = pathname === "/app";

  function goNew() {
    newConversation();
    if (!onChat) router.push("/app");
  }
  function goSelect(id: string) {
    selectConversation(id);
    if (!onChat) router.push("/app");
  }

  return (
    <Sidebar>
      <SidebarHeader>
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
            {conversations.length === 0 && (
              <p className="px-2 py-1 text-xs text-sidebar-foreground/60">No chats yet</p>
            )}
            {conversations.map((c) => (
              <SidebarMenuItem key={c.id}>
                <SidebarMenuButton
                  isActive={onChat && c.id === activeId}
                  onClick={() => goSelect(c.id)}
                >
                  <ChatIcon />
                  <span className="truncate">{c.title}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  showOnHover
                  aria-label="Delete chat"
                  onClick={() => deleteConversation(c.id)}
                >
                  <CloseIcon className="size-3.5" />
                </SidebarMenuAction>
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

      <SidebarRail />
    </Sidebar>
  );
}
