import Link from "next/link";
import { UserIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { currentUserId, getSession } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AccountDropdown } from "@/components/auth/account-dropdown";
import { WishlistSessionSync } from "@/components/wishlist/wishlist-button";

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
  const session = await getSession();
  const userId = session?.user ? await currentUserId() : null;
  if (!session?.user || !userId) {
    return (
      <>
        <WishlistSessionSync userId={null} />
        <SignInLink />
      </>
    );
  }
  // Read the name fresh so an edit on /account shows without signing in again.
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const first = (user?.name ?? session.user.name ?? "there").split(" ")[0];
  return (
    <>
      <WishlistSessionSync userId={userId} />
      <AccountDropdown firstName={first} email={session.user.email ?? ""} />
    </>
  );
}
