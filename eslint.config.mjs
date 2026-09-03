import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Keep ESLint focused on correctness; Prettier owns formatting.
  eslintConfigPrettier,
  {
    rules: {
      // Allow intentionally-unused identifiers when prefixed with `_`
      // (e.g. mock signatures that must match a real API but ignore args).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "src/generated/**",
    // Vendored shadcn/ui primitives — copied verbatim from the generator,
    // not held to this project's lint rules (they trip newer react-hooks rules).
    "src/components/ui/**",
    "src/hooks/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
