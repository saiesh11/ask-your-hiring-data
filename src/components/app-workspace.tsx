"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CollapseIcon, HomeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar, type SidebarViewer } from "./app-sidebar";
import { ChatStoreProvider, useChatStore } from "./chat-store";

/** A pull-tab pinned to the sidebar's edge, vertically centred, that toggles it. */
function SidebarEdgeTab() {
  const { toggleSidebar, state, isMobile } = useSidebar();
  const open = state === "expanded" && !isMobile;
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      style={{ left: open ? "var(--sidebar-width)" : 0 }}
      className="fixed top-1/2 z-50 flex h-24 w-5 -translate-x-px -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 bg-sidebar text-muted-foreground shadow-md transition-[left,width,background-color,color] hover:w-6 hover:bg-sidebar-accent hover:text-foreground"
    >
      <CollapseIcon className={cn("size-4 transition-transform", !open && "rotate-180")} />
    </button>
  );
}

/** Home = a fresh chat on /app, not the marketing landing page. */
function HomeButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { newConversation } = useChatStore();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => {
        newConversation();
        if (pathname !== "/app") router.push("/app");
      }}
    >
      <HomeIcon className="size-4" />
      Home
    </Button>
  );
}

export function AppWorkspace({ viewer, children }: { viewer: SidebarViewer; children: ReactNode }) {
  return (
    <ChatStoreProvider>
      <SidebarProvider>
        <AppSidebar viewer={viewer} />
        <SidebarInset className="relative h-dvh">
          <SidebarEdgeTab />
          <header className="flex h-12 shrink-0 items-center px-3">
            <HomeButton />
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ChatStoreProvider>
  );
}
