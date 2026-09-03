import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask Your Hiring Data",
  description:
    "Read-only natural-language analytics over a synthetic hiring dataset. The model proposes a schema-validated query IR; a deterministic executor computes grounded, role-scoped answers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
