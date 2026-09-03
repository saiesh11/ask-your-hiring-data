import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolve the `@/*` path alias from tsconfig.json (native Vite support).
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Pure logic (query-ir, data, executor, pipeline, eval) runs in Node.
    // Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
