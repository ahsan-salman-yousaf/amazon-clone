"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckIcon, MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { addToCart, buyNow, type AddToCartState } from "@/app/cart/actions";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export function QuantityStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-10 items-center rounded-full border border-input bg-white/80">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity" className={`grid size-10 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40 ${ring}`}>
        <MinusIcon aria-hidden className="size-4" />
      </button>
      <output aria-live="polite" aria-label="Quantity" className="w-8 text-center text-sm font-medium tabular-nums">
        {value}
      </output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity" className={`grid size-10 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40 ${ring}`}>
        <PlusIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function AddToCartForm({ productId, maxQuantity, disabled }: { productId: number; maxQuantity: number; disabled?: boolean }) {
  const [qty, setQty] = useState(1);
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null);
  const max = Math.max(1, maxQuantity);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={qty} />
      {!disabled && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" id="qty-label">
            Quantity
          </span>
          <QuantityStepper value={qty} max={max} onChange={(n) => setQty(Math.max(1, Math.min(max, n)))} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={disabled || pending}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50",
            ring,
          )}
        >
          <ShoppingCartIcon aria-hidden className="size-4" />
          {pending ? "Adding…" : "Add to cart"}
        </button>
        <button
          type="submit"
          formAction={buyNow}
          disabled={disabled || pending}
          className={cn("h-12 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50", ring)}
        >
          Buy now
        </button>
      </div>
      <p role="status" className={cn("min-h-5 text-sm", state?.ok ? "text-stock" : "text-sale")}>
        {state?.ok && (
          <>
            <CheckIcon aria-hidden className="mr-1 inline size-4 align-[-3px]" />
            {state.message} ·{" "}
            <Link href="/cart" className="font-medium text-foreground underline underline-offset-2">
              View cart
            </Link>
          </>
        )}
        {state && !state.ok && state.message}
      </p>
    </form>
  );
}
