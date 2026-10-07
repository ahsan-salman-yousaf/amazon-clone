import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HeartIcon } from "lucide-react";
import { currentUserId } from "@/auth";
import { ProductCard } from "@/components/product-card";
import { WishlistItemActions } from "@/components/wishlist/wishlist-item-actions";
import { listWishlist } from "@/lib/wishlist";

export const metadata: Metadata = { title: "Your wishlist" };

export default function WishlistPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Your wishlist</h1>
      <Suspense fallback={<div className="glass mt-6 h-72 rounded-3xl" aria-hidden />}>
        <Wishlist />
      </Suspense>
    </main>
  );
}

async function Wishlist() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?next=/wishlist");
  const items = await listWishlist(userId);
  if (!items.length) {
    return (
      <div className="glass mt-6 rounded-3xl px-6 py-14 text-center">
        <HeartIcon aria-hidden className="mx-auto size-8 text-brand" />
        <p className="mt-3 text-lg font-medium">Nothing saved yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any product to keep it here for later.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90">
          Explore products
        </Link>
      </div>
    );
  }
  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        {items.length} saved item{items.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
            <WishlistItemActions productId={p.id} title={p.title} inStock={p.stock > 0} />
          </li>
        ))}
      </ul>
    </>
  );
}
