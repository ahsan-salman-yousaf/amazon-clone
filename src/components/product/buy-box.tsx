import { RotateCcwIcon, ShieldCheckIcon, StoreIcon, TruckIcon } from "lucide-react";
import { DeliveryDate } from "@/components/delivery-date";
import { AddToCartForm } from "@/components/product/add-to-cart-form";
import { EXPRESS_TRANSIT_DAYS } from "@/lib/delivery";
import { discountPercent, formatMoney } from "@/lib/format";
import { EXPRESS_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/pricing";

export type BuyBoxProduct = {
  id: number;
  title: string;
  priceCents: number;
  listPriceCents: number;
  stock: number;
  dispatchDaysMin: number;
  dispatchDaysMax: number;
  warranty: string | null;
  returnPolicy: string | null;
};

export const LOW_STOCK = 10;

export function StockStatus({ stock }: { stock: number }) {
  if (stock <= 0) return <p className="text-sm font-medium text-sale">Out of stock</p>;
  if (stock <= LOW_STOCK) return <p className="text-sm font-medium text-sale">Only {stock} left in stock</p>;
  return <p className="text-sm font-medium text-stock">In stock</p>;
}

export function BuyBox({ product: p }: { product: BuyBoxProduct }) {
  const off = discountPercent(p.priceCents, p.listPriceCents);
  return (
    <section aria-label="Buy" className="glass flex flex-col gap-4 rounded-3xl p-5">
      <div>
        <p className="flex items-baseline gap-2">
          {off > 0 && <span className="text-sm font-semibold text-sale">-{off}%</span>}
          <span className="text-3xl font-semibold tracking-tight">{formatMoney(p.priceCents)}</span>
        </p>
        {off > 0 && (
          <p className="text-sm text-muted-foreground">
            List price <s>{formatMoney(p.listPriceCents)}</s> · You save {formatMoney(p.listPriceCents - p.priceCents)}
          </p>
        )}
      </div>

      {p.stock > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-white/70 p-3.5 text-sm">
          <TruckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-stock" />
          <p>
            <b className="font-semibold">
              <DeliveryDate dispatchDaysMin={p.dispatchDaysMin} dispatchDaysMax={p.dispatchDaysMax} format="long" />
            </b>
            <br />
            <span className="text-muted-foreground">
              Free delivery on orders over {formatMoney(FREE_SHIPPING_THRESHOLD_CENTS)} · or{" "}
              <DeliveryDate dispatchDaysMin={p.dispatchDaysMin} dispatchDaysMax={p.dispatchDaysMax} transitDays={EXPRESS_TRANSIT_DAYS} prefix="" /> with
              Express ({formatMoney(EXPRESS_SHIPPING_CENTS)})
            </span>
          </p>
        </div>
      )}

      <StockStatus stock={p.stock} />
      <AddToCartForm productId={p.id} maxQuantity={Math.min(10, p.stock)} disabled={p.stock <= 0} />

      <ul className="flex flex-col gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
        {p.returnPolicy && (
          <li className="flex items-center gap-2">
            <RotateCcwIcon aria-hidden className="size-3.5" /> {p.returnPolicy}
          </li>
        )}
        {p.warranty && (
          <li className="flex items-center gap-2">
            <ShieldCheckIcon aria-hidden className="size-3.5" /> {p.warranty}
          </li>
        )}
        <li className="flex items-center gap-2">
          <StoreIcon aria-hidden className="size-3.5" /> Sold and shipped by Olympus Cart
        </li>
      </ul>
    </section>
  );
}
