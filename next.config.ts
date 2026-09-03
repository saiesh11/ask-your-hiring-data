import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma's runtime out of the bundle — it uses Node built-ins the
  // bundler shouldn't touch.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
