import Link from "next/link";
import { UserIcon } from "lucide-react";
import { auth } from "@/auth";
import { AccountDropdown } from "@/components/auth/account-dropdown";

const linkClass =
  "flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export function SignInLink() {
  return (
    <Link href="/signin" className={linkClass}>
      <UserIcon aria-hidden className="size-4" />
      <span className="hidden sm:inline">Sign in</span>
      <span className="sr-only sm:hidden">Sign in</span>
    </Link>
  );
}

/** Streams per request: "Sign in" for guests, "Hi, Name" + menu when signed in. */
export async function AccountMenu() {
  const session = await auth();
  if (!session?.user) return <SignInLink />;
  const first = (session.user.name ?? "there").split(" ")[0];
  return <AccountDropdown firstName={first} email={session.user.email ?? ""} />;
}
