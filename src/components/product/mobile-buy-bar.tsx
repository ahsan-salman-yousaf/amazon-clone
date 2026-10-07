"use client";

import { useActionState, type ReactNode } from "react";
import { addToCart, type AddToCartState } from "@/app/cart/actions";

/** Mobile only: price, delivery and Add to cart stay reachable while scrolling. */
export function MobileBuyBar({
  productId,
  price,
  delivery,
  disabled,
  needsSize,
}: {
  productId: number;
  price: string;
  delivery: ReactNode;
  disabled?: boolean;
  needsSize?: boolean;
}) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null);
  return (
    <form
      action={action}
      // Sized products are added from the size picker; the bar takes you there.
      onSubmit={(e) => {
        if (!needsSize) return;
        e.preventDefault();
        const picker = document.getElementById("size-picker");
        picker?.scrollIntoView({ behavior: "smooth", block: "center" });
        picker?.querySelector<HTMLButtonElement>("[data-size]:not(:disabled)")?.focus({ preventScroll: true });
      }}
      className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-border bg-white/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={1} />
      <div className="mr-auto min-w-0">
        <p className="text-lg leading-none font-semibold">{price}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground" role="status">
          {state ? state.message : delivery}
        </p>
      </div>
      <button
        type="submit"
        disabled={disabled || pending}
        className="h-11 shrink-0 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50"
      >
        {disabled ? "Out of stock" : needsSize ? "Choose size" : pending ? "Adding…" : "Add to cart"}
      </button>
    </form>
  );
}
