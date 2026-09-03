"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CollapseIcon, HomeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { ChatStoreProvider, useChatStore } from "./chat-store";

/**
 * Pull-tab on the sidebar's edge that toggles it. Positioned with inline
 * styles on purpose — it must not depend on any utility class the dev
 * bundler might fail to emit, which is how it kept drifting to the top.
 */
function SidebarEdgeTab() {
  const { toggleSidebar, state, isMobile } = useSidebar();
  const [hover, setHover] = useState(false);
  const open = state === "expanded" && !isMobile;
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      style={{
        position: "fixed",
        top: "50%",
        left: open ? "var(--sidebar-width)" : "0px",
        transform: "translate(-1px, -50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "96px",
        width: hover ? "24px" : "20px",
        background: hover ? "var(--sidebar-accent)" : "var(--sidebar)",
        color: hover ? "var(--sidebar-accent-foreground)" : "var(--muted-foreground)",
        border: "1px solid var(--sidebar-border)",
        borderLeft: "none",
        borderRadius: "0 10px 10px 0",
        boxShadow: "0 4px 14px -4px rgb(0 0 0 / 0.35)",
        transition: "left 200ms ease, width 150ms ease, background-color 150ms ease",
      }}
    >
      <CollapseIcon
        width={16}
        height={16}
        style={{ transform: open ? "none" : "rotate(180deg)", transition: "transform 200ms ease" }}
      />
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

export function AppWorkspace({ children }: { children: ReactNode }) {
  return (
    <ChatStoreProvider>
      <SidebarProvider>
        <AppSidebar />
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
