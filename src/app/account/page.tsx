import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { ChevronRightIcon, HeartIcon, PackageIcon } from "lucide-react";
import { currentUserId } from "@/auth";
import { AddressBook } from "@/components/account/address-book";
import { NameForm } from "@/components/account/name-form";
import { db } from "@/db";
import { users } from "@/db/schema";
import { listAddresses } from "@/lib/address-book";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Your account</h1>
      <Suspense fallback={<div className="glass mt-6 h-96 rounded-3xl" aria-hidden />}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?next=/account");
  const [[user], addresses] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
    listAddresses(userId),
  ]);
  const links = [
    { href: "/orders", label: "Your orders", sub: "Track, return or review what you bought", icon: PackageIcon },
    { href: "/wishlist", label: "Your wishlist", sub: "Things you saved for later", icon: HeartIcon },
  ];
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, label, sub, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="glass group flex items-center gap-4 rounded-3xl p-5 transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-white/80">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{label}</span>
              <span className="block text-sm text-muted-foreground">{sub}</span>
            </span>
            <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <section aria-labelledby="profile" className="glass rounded-3xl p-5 sm:p-6">
        <h2 id="profile" className="text-lg font-semibold tracking-tight">
          Profile
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NameForm name={user.name} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <p className="flex h-11 items-center rounded-xl bg-black/[0.04] px-3.5 text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </section>

      <AddressBook addresses={addresses} />
    </div>
  );
}
