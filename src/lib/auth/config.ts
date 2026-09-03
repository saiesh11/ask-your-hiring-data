import * as z from "zod";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "./password";

// NOT strict: NextAuth passes csrfToken / callbackUrl alongside the fields.
const CredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Auth.js (NextAuth v5) config: email + password against the Postgres `User`
 * table, JWT sessions (no session table). The signed-in user's id is carried
 * on the token and copied onto `session.user.id`.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user?.id) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (typeof token.id === "string" && session.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};
