import "server-only";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import { connection } from "next/server";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

// Owner decision: Auth.js + Credentials (email + password, bcrypt) with JWT
// sessions. Users live in Postgres; the session is an encrypted httpOnly cookie.

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

/** Returns the user when the email + password match, otherwise null. */
export async function verifyCredentials(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: (credentials) => verifyCredentials(credentials),
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});

/**
 * The session for this request. Auth.js creates a random CSRF token while
 * reading it, which Cache Components forbids during prerendering, so mark
 * the call as request-time first.
 */
export async function getSession() {
  await connection();
  return auth();
}

/**
 * The signed-in user's id, or null. A session whose user no longer exists is
 * treated as signed out. Deduplicated per request.
 */
export const currentUserId = cache(async (): Promise<string | null> => {
  const id = (await getSession())?.user?.id;
  if (!id) return null;
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return row?.id ?? null;
});
