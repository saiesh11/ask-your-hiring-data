import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads env files. Load .env.local (this repo's
// convention) then .env, without overriding anything already set (e.g. by CI).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnv({ path: file, override: false });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations / introspection use the DIRECT (session-pooler) connection.
  // Read directly from process.env so a clean clone with no env file can still
  // run `prisma generate` (which needs no connection); migrate commands then
  // fail loudly if it is genuinely missing.
  datasource: { url: process.env.DIRECT_URL },
});
