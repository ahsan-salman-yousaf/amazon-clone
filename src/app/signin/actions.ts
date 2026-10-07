"use server";

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { z } from "zod";
import { credentialsSchema, signIn, signOut, verifyCredentials } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { cookies } from "next/headers";
import { CART_COOKIE, mergeGuestCartInto } from "@/lib/cart";
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from "@/lib/demo";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  values?: { name?: string; email?: string };
} | null;

/** Only same-site paths, never "//evil.com" or absolute URLs. */
function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

async function finishSignIn(user: { id: string }, email: string, password: string, next: string) {
  await mergeGuestCartInto(user.id);
  // signIn throws a redirect on success, which Next turns into navigation.
  await signIn("credentials", { email, password, redirectTo: next });
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const user = await verifyCredentials({ email, password });
  if (!user) return { error: "That email and password don't match an account.", values: { email } };
  try {
    await finishSignIn(user, user.email, password, next);
  } catch (e) {
    if (e instanceof AuthError) return { error: "Sign-in failed. Please try again.", values: { email } };
    throw e;
  }
  return null;
}

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Enter your name").max(80),
});

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { name: formData.get("name"), email: formData.get("email"), password: formData.get("password") };
  const values = { name: String(raw.name ?? ""), email: String(raw.email ?? "") };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: NonNullable<AuthFormState>["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "name" | "email" | "password";
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values };
  }
  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!created) {
    return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  }
  try {
    await finishSignIn(created, email, password, safeNext(formData.get("next")));
  } catch (e) {
    if (e instanceof AuthError) return { error: "Account created, but sign-in failed. Please sign in.", values };
    throw e;
  }
  return null;
}

export async function demoSignInAction(formData: FormData) {
  const next = safeNext(formData.get("next"));
  let [demo] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${DEMO_EMAIL}`).limit(1);
  if (!demo) {
    // Self-heal if the seed hasn't run on this database.
    [demo] = await db
      .insert(users)
      .values({ name: DEMO_NAME, email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) })
      .onConflictDoNothing()
      .returning({ id: users.id });
  }
  if (!demo) throw new Error("Demo account is unavailable");
  await finishSignIn(demo, DEMO_EMAIL, DEMO_PASSWORD, next);
}

export async function signOutAction() {
  // A signed-in cart lives on the account; make sure no guest cookie lingers.
  (await cookies()).delete(CART_COOKIE);
  await signOut({ redirectTo: "/" });
}
