"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, ShoppingCartIcon } from "lucide-react";
import { moveWishlistToCart, toggleWishlist } from "@/app/wishlist/actions";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export function WishlistItemActions({ productId, title, inStock }: { productId: number; title: string; inStock: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <button
        type="button"
        disabled={!inStock || pending}
        onClick={() =>
          start(async () => {
            const r = await moveWishlistToCart(productId);
            setMessage(r.message);
            if (r.ok) router.refresh();
          })
        }
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50 ${ring}`}
      >
        {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <ShoppingCartIcon aria-hidden className="size-4" />}
        {inStock ? "Move to cart" : "Out of stock"}
        <span className="sr-only"> {title}</span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await toggleWishlist(productId, false);
            router.refresh();
          })
        }
        className={`h-8 rounded-full text-xs font-medium text-foreground/70 transition-colors hover:text-foreground hover:underline ${ring}`}
      >
        Remove<span className="sr-only"> {title} from your wishlist</span>
      </button>
      <p role="status" className="min-h-4 text-center text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
