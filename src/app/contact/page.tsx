import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { ChevronRightIcon, ClockIcon, MailIcon, PackageIcon, RotateCcwIcon, UserIcon } from "lucide-react";
import { currentUserId } from "@/auth";
import { ContactForm } from "@/components/contact/contact-form";
import { db } from "@/db";
import { users } from "@/db/schema";

export const metadata: Metadata = { title: "Contact us", description: "Get help with an order, a return or your Olympus Cart account." };

const shortcuts = [
  { href: "/orders", icon: PackageIcon, title: "Track an order", sub: "Status, delivery date and order details" },
  { href: "/orders", icon: RotateCcwIcon, title: "Start a return", sub: "Pick items from a delivered order" },
  { href: "/account", icon: UserIcon, title: "Manage your account", sub: "Name, addresses and saved items" },
];

export default function ContactPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-20 lg:px-8">
      <p className="text-sm font-semibold tracking-wider text-star uppercase">Help &amp; contact</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance lg:text-4xl">How can we help?</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Most answers are one click away. If not, send us a message and we&apos;ll get back to you.</p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {shortcuts.map(({ href, icon: Icon, title, sub }) => (
          <li key={title}>
            <Link
              href={href}
              className="glass group flex h-full items-center gap-3 rounded-3xl p-4 transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/80 transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section aria-labelledby="write-to-us">
          <h2 id="write-to-us" className="mb-4 text-xl font-semibold tracking-tight">
            Send us a message
          </h2>
          <Suspense fallback={<div className="glass h-96 rounded-3xl" aria-hidden />}>
            <PrefilledForm />
          </Suspense>
        </section>
        <aside className="glass flex h-fit flex-col gap-4 rounded-3xl p-5 text-sm">
          <h2 className="font-semibold tracking-tight">Other ways to reach us</h2>
          <p className="flex items-start gap-2">
            <MailIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-medium">Email</span>
              <span className="text-muted-foreground">support@olympuscart.example</span>
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ClockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-medium">Support hours</span>
              <span className="text-muted-foreground">Monday to Friday, 9 am – 6 pm ET. Replies within one business day.</span>
            </span>
          </p>
          <p className="rounded-2xl bg-white/60 p-3 text-xs text-muted-foreground">
            Olympus Cart is a demo project and is not affiliated with Amazon. Messages are stored for the demo, but no one will reply.
          </p>
        </aside>
      </div>
    </main>
  );
}

async function PrefilledForm() {
  const userId = await currentUserId();
  const [user] = userId ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1) : [];
  return <ContactForm defaultName={user?.name} defaultEmail={user?.email} />;
}
