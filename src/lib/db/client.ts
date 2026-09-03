import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma 7 runtime client. Prisma 7 dropped `datasourceUrl` / `datasources` on
 * the constructor — the connection now comes from a driver adapter. We use the
 * pooled Supabase connection (`DATABASE_URL`, transaction pooler); migrations
 * use `DIRECT_URL` via prisma.config.ts.
 *
 * A single instance is cached on `globalThis` in dev so Next's hot reload
 * doesn't open a new pool on every change.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — the app needs the pooled Supabase connection string (see .env.example).",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
