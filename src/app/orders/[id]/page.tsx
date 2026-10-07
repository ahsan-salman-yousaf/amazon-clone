import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2Icon, CircleIcon, PackageOpenIcon, RotateCcwIcon, XCircleIcon } from "lucide-react";
import { currentUserId } from "@/auth";
import { LocalTime } from "@/components/local-time";
import { StatusPill } from "@/components/orders/status";
import { formatMoney } from "@/lib/format";
import { getOrder } from "@/lib/orders";
import { RETURN_REASONS, listReturns, returnableItems } from "@/lib/returns";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details" };

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <Suspense fallback={<div className="glass h-96 rounded-3xl" aria-hidden />}>
        <Order params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Order({ params, searchParams }: Pick<PageProps<"/orders/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect(`/signin?next=/orders/${id}`);
  const data = await getOrder(userId, id);
  if (!data) notFound();
  const { order, items, events, payment } = data;
  const sp = await searchParams;
  const justPlaced = sp.placed === "1" && order.status === "paid";
  const [orderReturns, returnable] = await Promise.all([listReturns(order.id), returnableItems(userId, order.id)]);
  const canReturn = !!returnable?.delivered && returnable.items.some((i) => !i.blockedReason);
  const failed = order.status === "payment_failed";
  const range =
    order.estimatedDeliveryFrom === order.estimatedDeliveryTo
      ? day(order.estimatedDeliveryFrom)
      : `${day(order.estimatedDeliveryFrom)} – ${day(order.estimatedDeliveryTo)}`;

  // Timeline: what happened, then what's still to come.
  const reached = new Set(events.map((e) => e.status));
  const steps = failed
    ? events.map((e) => ({ key: String(e.id), label: e.note ?? e.status, at: e.at, done: e.status !== "payment_failed", failed: e.status === "payment_failed" }))
    : [
        { key: "placed", label: "Order placed", at: events.find((e) => e.status === "pending_payment")?.at, done: true, failed: false },
        { key: "paid", label: payment?.cardLast4 ? `Payment confirmed · ${payment.cardBrand} ending ${payment.cardLast4}` : "Payment confirmed", at: events.find((e) => e.status === "paid")?.at, done: reached.has("paid"), failed: false },
        { key: "shipped", label: "Shipped", at: events.find((e) => e.status === "shipped")?.at, done: reached.has("shipped"), failed: false },
        { key: "delivered", label: `Delivered${reached.has("delivered") ? "" : ` · estimated ${range}`}`, at: events.find((e) => e.status === "delivered")?.at, done: reached.has("delivered"), failed: false },
      ];

  return (
    <>
      {justPlaced && (
        <div role="status" className="glass mb-6 flex items-start gap-3 rounded-3xl p-5">
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-stock" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Thank you, your order is placed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Estimated delivery <b className="text-foreground">{range}</b>. This was a simulated payment, so nothing was charged.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono">{order.number}</span>
          </p>
          {justPlaced ? (
            <h2 className="text-2xl font-semibold tracking-tight">Order details</h2>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">Order details</h1>
          )}
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="timeline" className="glass rounded-3xl p-5">
            <h2 id="timeline" className="font-semibold tracking-tight">
              Status
            </h2>
            <ol className="mt-4 flex flex-col">
              {steps.map((s, i) => (
                <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && <span aria-hidden className={cn("absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-0.5", s.done ? "bg-stock" : "bg-black/10")} />}
                  {s.failed ? (
                    <XCircleIcon aria-hidden className="size-6 shrink-0 text-sale" />
                  ) : s.done ? (
                    <CheckCircle2Icon aria-hidden className="size-6 shrink-0 text-stock" />
                  ) : (
                    <CircleIcon aria-hidden className="size-6 shrink-0 text-black/20" />
                  )}
                  <div className="text-sm">
                    <p className={cn("font-medium", !s.done && !s.failed && "text-muted-foreground")}>
                      {s.label}
                      <span className="sr-only">{s.failed ? " (failed)" : s.done ? " (done)" : " (upcoming)"}</span>
                    </p>
                    {s.at && (
                      <p className="text-xs text-muted-foreground">
                        <LocalTime iso={s.at.toISOString()} />
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {failed && (
              <Link href="/checkout" className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
                Try checkout again
              </Link>
            )}
          </section>

          {sp.return === "requested" && (
            <div role="status" className="glass flex items-start gap-3 rounded-3xl p-5">
              <RotateCcwIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-stock" />
              <p className="text-sm">
                <b>Return requested.</b> Your refund is issued automatically once the parcel reaches our warehouse (about 2 minutes in this demo).
                Reload this page to see it.
              </p>
            </div>
          )}

          {orderReturns.length > 0 && (
            <section aria-labelledby="returns" className="glass rounded-3xl p-5">
              <h2 id="returns" className="font-semibold tracking-tight">
                Returns
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {orderReturns.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-white/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{r.items.map((i) => `${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ""}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}</p>
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
                          r.status === "refunded" ? "bg-stock/10 text-stock" : "bg-black/5",
                        )}
                      >
                        {r.status === "refunded" ? `Refunded ${formatMoney(r.refundCents)}` : "Return requested"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {RETURN_REASONS[r.reason]} · requested <LocalTime iso={r.createdAt.toISOString()} />
                      {r.refundedAt && (
                        <>
                          {" "}
                          · refunded <LocalTime iso={r.refundedAt.toISOString()} />
                          {payment?.cardLast4 && ` to ${payment.cardBrand ?? "card"} ending ${payment.cardLast4}`}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="items" className="glass rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="items" className="font-semibold tracking-tight">
                Items
              </h2>
              {canReturn && (
                <Link
                  href={`/orders/${order.id}/return`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-white/70 px-4 text-sm font-medium transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <PackageOpenIcon aria-hidden className="size-4" /> Return items
                </Link>
              )}
            </div>
            <ul className="mt-3 divide-y divide-border">
              {items.map((it) => (
                <li key={`${it.productId}:${it.variantId ?? ""}`} className="flex items-center gap-4 py-3">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/80">
                    <Image src={it.thumbnail} alt="" fill sizes="64px" className="object-contain p-1.5" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/p/${it.slug}`} className="line-clamp-2 rounded-md font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                      {it.title}
                    </Link>
                    <p className="text-muted-foreground">
                      {it.variantLabel && <>Size {it.variantLabel} · </>}Qty {it.quantity} · {formatMoney(it.unitPriceCents)} each
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
                      {order.status === "delivered" && (
                        <Link href={`/p/${it.slug}#write-review`} className="text-foreground/80 underline-offset-2 hover:text-foreground hover:underline">
                          Write a review<span className="sr-only"> of {it.title}</span>
                        </Link>
                      )}
                      <Link href={`/p/${it.slug}`} className="text-foreground/80 underline-offset-2 hover:text-foreground hover:underline">
                        Buy again<span className="sr-only">: {it.title}</span>
                      </Link>
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(it.unitPriceCents * it.quantity)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="ship-to" className="glass rounded-3xl p-5 text-sm">
            <h2 id="ship-to" className="font-semibold tracking-tight">
              Shipping to
            </h2>
            <address className="mt-2 leading-relaxed not-italic text-foreground/85">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 && (
                <>
                  <br />
                  {order.shippingAddress.line2}
                </>
              )}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              <br />
              United States
            </address>
            <p className="mt-3 text-muted-foreground">{order.shippingSpeed === "expedited" ? "Express delivery" : "Standard delivery"}</p>
          </section>
          <section aria-labelledby="totals" className="glass rounded-3xl p-5">
            <h2 id="totals" className="font-semibold tracking-tight">
              Payment
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt>Items</dt>
                <dd className="tabular-nums">{formatMoney(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd className="tabular-nums">{order.shippingCents ? formatMoney(order.shippingCents) : "Free"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Estimated tax</dt>
                <dd className="tabular-nums">{formatMoney(order.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
            {payment && (
              <p className="mt-3 text-xs text-muted-foreground">
                {payment.provider === "simulated" ? "Simulated payment" : "Stripe test mode"}
                {payment.cardLast4 && ` · ${payment.cardBrand ?? "Card"} ending ${payment.cardLast4}`}
              </p>
            )}
          </section>
          <Link href="/orders" className="text-center text-sm font-medium underline-offset-2 hover:underline">
            View all orders
          </Link>
        </aside>
      </div>
    </>
  );
}
