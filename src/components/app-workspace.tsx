"use client";

import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type SidebarViewer } from "./app-sidebar";
import { ChatStoreProvider } from "./chat-store";

export function AppWorkspace({ viewer, children }: { viewer: SidebarViewer; children: ReactNode }) {
  return (
    <ChatStoreProvider>
      <SidebarProvider>
        <AppSidebar viewer={viewer} />
        <SidebarInset className="h-dvh">
          <header className="flex h-12 shrink-0 items-center gap-2 px-3">
            <SidebarTrigger />
            <span className="font-mono text-xs tracking-wide text-muted-foreground">
              ask your hiring data
            </span>
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ChatStoreProvider>
  );
}
