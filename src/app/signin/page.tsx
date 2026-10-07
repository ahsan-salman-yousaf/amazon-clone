import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUserId } from "@/auth";
import { AuthForms, DemoSignIn } from "@/components/auth/auth-forms";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

export const metadata: Metadata = { title: "Sign in" };

const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/");

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-10 pb-20">
      <h1 className="text-center text-2xl font-semibold tracking-tight">Welcome to Olympus Cart</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Sign in or create an account to check out.</p>
      <div className="glass mt-8 flex flex-col gap-6 rounded-3xl p-6">
        <Suspense fallback={<div className="h-80" aria-hidden />}>
          <Forms searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Olympus Cart is a demo store and is not affiliated with Amazon. Never enter your real Amazon credentials here.
      </p>
    </main>
  );
}

async function Forms({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUserId()) redirect(next);
  return (
    <>
      <AuthForms next={next} initialTab={params.tab === "create" ? "create" : "signin"} />
      <DemoSignIn next={next} email={DEMO_EMAIL} password={DEMO_PASSWORD} />
    </>
  );
}
