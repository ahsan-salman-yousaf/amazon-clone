"use client";

import { useRef } from "react";
import { updateQuantity } from "@/app/cart/actions";

/** Changing the select submits right away; the Update button covers no-JS. */
export function QuantitySelect({ productId, quantity, max, title }: { productId: number; quantity: number; max: number; title: string }) {
  const form = useRef<HTMLFormElement>(null);
  const options = Array.from({ length: Math.max(max, quantity) }, (_, i) => i + 1);
  return (
    <form ref={form} action={updateQuantity} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="sr-only" htmlFor={`qty-${productId}`}>
        Quantity for {title}
      </label>
      <select
        id={`qty-${productId}`}
        name="quantity"
        defaultValue={quantity}
        key={quantity}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 rounded-full border border-input bg-white/80 pr-8 pl-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            Qty {n}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-sm underline">
          Update
        </button>
      </noscript>
    </form>
  );
}
