import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUserId } from "@/auth";
import { StatusPill } from "@/components/orders/status";
import { formatMoney } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export const metadata: Metadata = { title: "Your orders" };

const date = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function OrdersPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Your orders</h1>
      <Suspense fallback={<div className="glass mt-6 h-64 rounded-3xl" aria-hidden />}>
        <Orders />
      </Suspense>
    </main>
  );
}

async function Orders() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?next=/orders");
  const orders = await listOrders(userId);

  if (!orders.length) {
    return (
      <div className="glass mt-6 rounded-3xl px-6 py-14 text-center">
        <p className="text-lg font-medium">No orders yet</p>
        <p className="mt-1 text-sm text-muted-foreground">When you place an order, it will show up here with its delivery status.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand/90">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-4">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="glass block rounded-3xl p-5 transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>
                <span className="font-medium">{date(o.createdAt)}</span> · <span className="font-mono text-muted-foreground">{o.number}</span>
              </p>
              <span className="flex flex-wrap items-center gap-1.5">
                {o.returnStatus === "in_progress" && (
                  <span className="inline-flex h-6 items-center rounded-full bg-black/5 px-2.5 text-xs font-semibold">Return in progress</span>
                )}
                {o.returnStatus && o.returnStatus !== "in_progress" && (
                  <span className="inline-flex h-6 items-center rounded-full bg-stock/10 px-2.5 text-xs font-semibold text-stock">
                    Refunded {formatMoney(o.returnStatus.refundedCents)}
                  </span>
                )}
                <StatusPill status={o.status} />
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex -space-x-3">
                {o.items.slice(0, 4).map((it) => (
                  <span key={it.title} className="relative size-14 overflow-hidden rounded-xl border-2 border-white bg-white">
                    <Image src={it.thumbnail} alt="" fill sizes="56px" className="object-contain p-1" />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">{o.items.map((i) => i.title).join(", ")}</p>
                <p className="text-muted-foreground">
                  {o.status === "delivered" ? `Delivered ${short(o.estimatedDeliveryFrom)}` : `Arrives ${short(o.estimatedDeliveryFrom)}${o.estimatedDeliveryTo !== o.estimatedDeliveryFrom ? ` – ${short(o.estimatedDeliveryTo)}` : ""}`}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatMoney(o.totalCents)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
