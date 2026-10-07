import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { TruckIcon } from "lucide-react";
import { CartLineShell, CartNotices, LineControls } from "@/components/cart/line-controls";
import { StockStatus } from "@/components/product/buy-box";
import { getCartView, MAX_PER_LINE, readCartId, type CartLine } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD_CENTS, amountToFreeShipping, shippingCents } from "@/lib/pricing";

export const metadata: Metadata = { title: "Cart" };

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export default function CartPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Shopping cart</h1>
      <Suspense fallback={<CartSkeleton />}>
        <Cart />
      </Suspense>
    </main>
  );
}

async function Cart() {
  const cart = await getCartView(await readCartId());

  if (!cart.lines.length && !cart.saved.length) {
    return (
      <div className="glass mt-6 rounded-3xl px-6 py-14 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">Find something you like and it will show up here.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/search?sort=discount" className={`inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90 ${ring}`}>
            Shop today&apos;s deals
          </Link>
          <Link href="/" className={`inline-flex h-11 items-center rounded-full border border-input bg-white/70 px-6 text-sm font-medium hover:bg-white ${ring}`}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const toFree = amountToFreeShipping(cart.subtotalCents);
  const shipping = shippingCents(cart.subtotalCents);
  const progress = Math.min(100, Math.round((cart.subtotalCents / FREE_SHIPPING_THRESHOLD_CENTS) * 100));

  return (
    <CartNotices>
    <div className="mt-6 lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-10">
      <div>
        {cart.lines.length > 0 ? (
          <ul aria-label="Items in your cart" className="glass divide-y divide-border rounded-3xl px-4 sm:px-6">
            {cart.lines.map((l) => (
              <LineItem key={l.lineId} line={l} />
            ))}
          </ul>
        ) : (
          <p className="glass rounded-3xl p-6 text-sm text-muted-foreground">Nothing in your cart right now. Move a saved item back below.</p>
        )}

        {cart.saved.length > 0 && (
          <section aria-labelledby="saved" className="mt-10">
            <h2 id="saved" className="text-lg font-semibold tracking-tight">
              Saved for later ({cart.saved.length})
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-3xl bg-white/50 px-4 sm:px-6">
              {cart.saved.map((l) => (
                <LineItem key={l.lineId} line={l} saved />
              ))}
            </ul>
          </section>
        )}
      </div>

      {cart.lines.length > 0 && (
        <aside aria-label="Order summary" className="mt-8 lg:sticky lg:top-24 lg:mt-0">
          <div className="glass flex flex-col gap-4 rounded-3xl p-5">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt>
                  Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})
                </dt>
                <dd className="font-semibold tabular-nums">{formatMoney(cart.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Standard delivery</dt>
                <dd className="tabular-nums">{shipping === 0 ? "Free" : formatMoney(shipping)}</dd>
              </div>
            </dl>

            <div className="rounded-2xl bg-white/70 p-3.5">
              <p className="flex items-center gap-2 text-sm">
                <TruckIcon aria-hidden className="size-4 shrink-0 text-stock" />
                {toFree > 0 ? (
                  <span>
                    Add <b>{formatMoney(toFree)}</b> for free delivery
                  </span>
                ) : (
                  <span className="font-medium text-stock">Your order qualifies for free delivery</span>
                )}
              </p>
              <div
                role="progressbar"
                aria-label="Progress to free delivery"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/10"
              >
                <div className="h-full rounded-full bg-stock transition-[width] duration-500 ease-smooth" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <Link
              href="/checkout"
              className={`inline-flex h-12 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 ${ring}`}
            >
              Proceed to checkout
            </Link>
            <p className="text-center text-xs text-muted-foreground">Taxes and delivery speed are chosen at checkout.</p>
          </div>
        </aside>
      )}
    </div>
    </CartNotices>
  );
}

function LineItem({ line: l, saved = false }: { line: CartLine; saved?: boolean }) {
  const outOfStock = l.stock <= 0;
  return (
    <CartLineShell>
      <Link href={`/p/${l.slug}`} className={`relative size-24 shrink-0 overflow-hidden rounded-2xl bg-white/80 sm:size-28 ${ring}`}>
        <Image src={l.thumbnail} alt="" fill sizes="112px" className="object-contain p-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/p/${l.slug}`} className={`line-clamp-2 rounded-md text-sm font-medium hover:underline ${ring}`}>
            {l.title}
          </Link>
          <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
            {formatMoney(l.priceCents)}
            {l.listPriceCents > l.priceCents && (
              <s className="block text-xs font-normal text-muted-foreground">{formatMoney(l.listPriceCents)}</s>
            )}
          </p>
        </div>
        {l.sizeLabel && (
          <p className="text-xs text-muted-foreground">
            Size: <span className="font-medium text-foreground">{l.sizeLabel}</span>
          </p>
        )}
        <StockStatus stock={l.stock} />
        {!saved && l.quantity > l.stock && l.stock > 0 && (
          <p className="text-xs text-sale">Only {l.stock} available; your quantity will be reduced at checkout.</p>
        )}
        <LineControls
          lineId={l.lineId}
          productId={l.productId}
          variantId={l.variantId}
          title={l.sizeLabel ? `${l.title} (${l.sizeLabel})` : l.title}
          quantity={l.quantity}
          max={Math.min(l.stock, MAX_PER_LINE)}
          saved={saved}
          canBuy={!outOfStock}
        />
      </div>
    </CartLineShell>
  );
}

function CartSkeleton() {
  return (
    <div aria-hidden className="mt-6 lg:grid lg:grid-cols-[1fr_340px] lg:gap-10">
      <div className="glass flex flex-col gap-6 rounded-3xl p-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="size-28 rounded-2xl bg-black/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-black/5" />
              <div className="h-4 w-1/4 rounded bg-black/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="glass mt-8 h-56 rounded-3xl lg:mt-0" />
    </div>
  );
}
