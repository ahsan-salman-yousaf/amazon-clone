import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUserId } from "@/auth";
import { ReturnForm } from "@/components/orders/return-form";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { TAX_RATE } from "@/lib/pricing";
import { RETURN_REASONS, returnableItems } from "@/lib/returns";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Return items" };

export default function ReturnPage({ params }: PageProps<"/orders/[id]/return">) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <Suspense fallback={<div className="glass h-96 rounded-3xl" aria-hidden />}>
        <Return params={params} />
      </Suspense>
    </main>
  );
}

async function Return({ params }: Pick<PageProps<"/orders/[id]/return">, "params">) {
  const { id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect(`/signin?next=/orders/${id}/return`);
  const state = await returnableItems(userId, id);
  if (!state) notFound();
  if (!state.delivered) redirect(`/orders/${id}`);
  const [order] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, id)).limit(1);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Order <span className="font-mono">{order.number}</span>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Return items</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Pick what you&apos;re sending back. In this demo the parcel &ldquo;arrives&rdquo; at our warehouse about 2 minutes after you request the return, and
        then the refund is issued automatically.
      </p>
      <ReturnForm
        orderId={id}
        taxRate={TAX_RATE}
        reasons={RETURN_REASONS}
        items={state.items.map((it) => ({
          itemId: it.itemId,
          variantLabel: it.variantLabel,
          title: it.title,
          thumbnail: it.thumbnail,
          unitPriceCents: it.unitPriceCents,
          remaining: it.remaining,
          windowDays: it.windowDays,
          closesAt: it.closesAt?.toISOString() ?? null,
          blockedReason: it.blockedReason,
        }))}
      />
    </>
  );
}
