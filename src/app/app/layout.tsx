import type { ReactNode } from "react";
import { AppWorkspace } from "@/components/app-workspace";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppWorkspace>{children}</AppWorkspace>;
}
