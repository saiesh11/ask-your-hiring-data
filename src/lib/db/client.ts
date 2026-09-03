import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma 7 runtime client. Prisma 7 dropped `datasourceUrl` / `datasources` on
 * the constructor — the connection comes from a driver adapter. We use the
 * pooled Supabase connection (`DATABASE_URL`, transaction pooler); migrations
 * use `DIRECT_URL` via prisma.config.ts.
 *
 * Construction is LAZY (behind a Proxy) so that merely importing this module —
 * e.g. for a type, or in a test that never touches the DB — does not require
 * `DATABASE_URL` or open a connection pool. The instance is cached on
 * `globalThis` in dev so Next's hot reload doesn't leak pools.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let instance: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — the app needs the pooled Supabase connection string (see .env.example).",
    );
  }
  instance =
    globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = instance;
  }
  return instance;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getClient();
    const value = Reflect.get(client, property, receiver) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
