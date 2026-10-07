"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Popover } from "radix-ui";
import { CheckIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { addToCart, getSizes, type AddToCartState } from "@/app/cart/actions";
import type { SizeOption } from "@/lib/catalog";
import { SIZE_LABEL, type SizeType } from "@/lib/sizes";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
const plus = `grid size-9 place-items-center rounded-full shadow-md transition-[transform,background-color] duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 ${ring}`;

/** The small round "+" on product cards (owner decision). Sized products open a size picker first. */
export function QuickAdd({ productId, title, sizeType, className }: { productId: number; title: string; sizeType?: SizeType | null; className?: string }) {
  if (sizeType) return <QuickAddSized productId={productId} title={title} sizeType={sizeType} className={className} />;
  return <QuickAddPlain productId={productId} title={title} className={className} />;
}

function QuickAddPlain({ productId, title, className }: { productId: number; title: string; className?: string }) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null);
  const done = state?.ok && !pending;
  return (
    <form action={action} className={className}>
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={done ? `${title} added to cart` : `Add ${title} to cart`}
        className={cn(plus, done ? "bg-stock text-white" : "bg-primary text-primary-foreground")}
      >
        {done ? <CheckIcon aria-hidden className="size-4" /> : <PlusIcon aria-hidden className="size-4" />}
      </button>
      <span role="status" className="sr-only">
        {state?.message}
      </span>
    </form>
  );
}

function QuickAddSized({ productId, title, sizeType, className }: { productId: number; title: string; sizeType: SizeType; className?: string }) {
  const [open, setOpen] = useState(false);
  const [sizes, setSizes] = useState<SizeOption[] | null>(null);
  const [state, setState] = useState<AddToCartState>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [loading, startLoad] = useTransition();
  const [, startAdd] = useTransition();
  const done = state?.ok && adding === null;
  const label = SIZE_LABEL[sizeType];
  const router = useRouter();

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setState(null);
      // Fresh stock each time it opens; cards are cached.
      startLoad(async () => setSizes(await getSizes(productId)));
    }
  };

  const add = (s: SizeOption) => {
    setAdding(s.id);
    startAdd(async () => {
      const fd = new FormData();
      fd.set("productId", String(productId));
      fd.set("variantId", String(s.id));
      const r = await addToCart(null, fd);
      setAdding(null);
      setState(r);
      if (r?.ok) router.refresh(); // updates the cart badge
      if (r?.ok) setTimeout(() => setOpen(false), 900);
    });
  };

  return (
    <div className={className}>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger
          aria-label={done ? `${title} added to cart` : `Choose a ${label.toLowerCase()} for ${title}`}
          className={cn(plus, done ? "bg-stock text-white" : "bg-primary text-primary-foreground")}
        >
          {done ? <CheckIcon aria-hidden className="size-4" /> : <PlusIcon aria-hidden className="size-4" />}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            className="glass z-50 w-64 rounded-2xl p-4 text-sm shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
          >
            <p className="font-semibold">Choose a {label.toLowerCase()}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{title}</p>
            {loading || !sizes ? (
              <p className="mt-3 flex items-center gap-2 text-muted-foreground" role="status">
                <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> Loading sizes…
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sizes.map((s) => {
                  const out = s.stock <= 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={out || adding !== null}
                      aria-label={out ? `${s.label}, sold out` : `Add size ${s.label} to cart`}
                      onClick={() => add(s)}
                      className={cn(
                        "inline-flex h-9 min-w-11 items-center justify-center rounded-full border border-input bg-white/90 px-3 text-xs font-medium tabular-nums transition-colors hover:border-brand hover:bg-brand/10 disabled:cursor-not-allowed",
                        out && "border-dashed text-muted-foreground line-through opacity-60 hover:border-input hover:bg-white/90",
                        ring,
                      )}
                    >
                      {adding === s.id ? <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" /> : s.label}
                    </button>
                  );
                })}
              </div>
            )}
            <p role="status" className={cn("mt-3 min-h-4 text-xs", state?.ok ? "text-stock" : "text-sale")}>
              {state?.ok ? (
                <>
                  <CheckIcon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                  {state.message} ·{" "}
                  <Link href="/cart" className="font-medium text-foreground underline underline-offset-2">
                    View cart
                  </Link>
                </>
              ) : (
                state?.message
              )}
            </p>
            <Popover.Arrow className="fill-white/80" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
