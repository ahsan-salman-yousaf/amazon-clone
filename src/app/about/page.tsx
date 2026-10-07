import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CalendarCheckIcon, LeafIcon, ListChecksIcon, TagIcon } from "lucide-react";
import { getCategories } from "@/lib/catalog";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/pricing";
import { db } from "@/db";
import { products } from "@/db/schema";
import { count } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

export const metadata: Metadata = {
  title: "About us",
  description: "Olympus Cart is a calmer way to shop: clear prices, honest delivery dates and a checkout that takes three steps.",
};

const values = [
  {
    icon: CalendarCheckIcon,
    title: "Honest delivery dates",
    body: "You see when something will actually arrive on every product, before it goes in your cart, in your own timezone. No surprises at checkout.",
  },
  {
    icon: TagIcon,
    title: "One clear price",
    body: "No members-only prices standing between you and the Add to cart button. What you see is what you pay, with tax and delivery shown before you place the order.",
  },
  {
    icon: LeafIcon,
    title: "Calm by design",
    body: "No sponsored clutter, no pop-ups fighting for attention. One search box, a few thoughtful rails, and room to think.",
  },
  {
    icon: ListChecksIcon,
    title: "Three steps to done",
    body: "Address, delivery, payment. Every error tells you exactly what to fix, and returns take a minute from your order page.",
  },
];

// In-world copy (owner decision); figures below come from the live catalog.
async function storeFacts() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const [[{ n }], cats] = await Promise.all([db.select({ n: count() }).from(products), getCategories()]);
  return { products: n, departments: cats.length };
}

export default async function AboutPage() {
  const facts = await storeFacts();
  const stats = [
    [String(facts.products), "products, every one with a real delivery date"],
    [String(facts.departments), "departments, from smartphones to groceries"],
    ["3", "steps from cart to confirmed order"],
    [`$${FREE_SHIPPING_THRESHOLD_CENTS / 100}`, "and up ships free with standard delivery"],
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-12 pb-24 lg:px-8">
      <section className="text-center">
        <p className="text-sm font-semibold tracking-wider text-star uppercase">About Olympus Cart</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance lg:text-6xl">
          Shopping that respects your time.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
          Olympus Cart started with a simple frustration: big online stores had become loud. Prices hid behind memberships, delivery dates appeared only at the
          last step, and checkout felt like a maze. We set out to build the opposite.
        </p>
      </section>

      <section aria-labelledby="believe" className="mt-16">
        <h2 id="believe" className="text-2xl font-semibold tracking-tight">
          What we believe
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, body }) => (
            <li key={title} className="glass group rounded-3xl p-6 transition-transform duration-300 ease-smooth hover:-translate-y-0.5">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand text-brand-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="numbers" className="mt-16">
        <h2 id="numbers" className="sr-only">
          Olympus Cart in numbers
        </h2>
        <dl className="glass grid grid-cols-2 gap-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-4">
          {stats.map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block text-3xl font-semibold tracking-tight tabular-nums">{n}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="promise" className="mt-16 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h2 id="promise" className="text-2xl font-semibold tracking-tight">
            Our promise
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If something isn&apos;t right, it should be easy to put right. Every order page shows exactly where your parcel is, every product shows its return
            window, and a return is a few taps away. Refunds go back to the card you paid with, automatically.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Start shopping <ArrowRightIcon aria-hidden className="size-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center rounded-full border border-input bg-white/70 px-6 text-sm font-medium transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Contact us
            </Link>
          </div>
        </div>
        <p className="rounded-3xl border border-dashed border-input bg-white/50 p-5 text-sm text-muted-foreground">
          <b className="text-foreground">A note on this site:</b> Olympus Cart is a demo project and is not affiliated with Amazon. Products come from an open demo
          catalog, and payments run in Stripe test mode, so no real orders are placed and no real money moves.
        </p>
      </section>
    </main>
  );
}
