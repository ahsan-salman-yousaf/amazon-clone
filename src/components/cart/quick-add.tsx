"use client";

import { useActionState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { addToCart, type AddToCartState } from "@/app/cart/actions";
import { cn } from "@/lib/utils";

/** The small round "+" on product cards (owner decision). */
export function QuickAdd({ productId, title, className }: { productId: number; title: string; className?: string }) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null);
  const done = state?.ok && !pending;
  return (
    <form action={action} className={className}>
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={done ? `${title} added to cart` : `Add ${title} to cart`}
        className={cn(
          "grid size-9 place-items-center rounded-full shadow-md transition-[transform,background-color] duration-200 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-95 disabled:opacity-60",
          done ? "bg-stock text-white" : "bg-primary text-primary-foreground",
        )}
      >
        {done ? <CheckIcon aria-hidden className="size-4" /> : <PlusIcon aria-hidden className="size-4" />}
      </button>
      <span role="status" className="sr-only">
        {state?.message}
      </span>
    </form>
  );
}
