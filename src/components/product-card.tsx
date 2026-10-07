import Image from "next/image";
import Link from "next/link";
import { StarIcon } from "lucide-react";
import { QuickAdd } from "@/components/cart/quick-add";
import { DeliveryDate } from "@/components/delivery-date";
import { DiscountBadge } from "@/components/discount-badge";
import type { ProductCardData } from "@/lib/catalog";
import { discountPercent, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Calm card: image, title, price, one line of rating + delivery, and a small "+" (owner decision). */
export function ProductCard({ product: p, className }: { product: ProductCardData; className?: string }) {
  const off = discountPercent(p.priceCents, p.listPriceCents);
  return (
    <div className={cn("relative", className)}>
      <Link
        href={`/p/${p.slug}`}
        className="group relative flex flex-col gap-2 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/80">
          <Image
            src={p.thumbnail}
            alt=""
            fill
            sizes="(min-width: 1024px) 220px, 45vw"
            className="object-contain p-4 transition-transform duration-300 ease-smooth group-hover:scale-[1.04]"
          />
          {off >= 5 && <DiscountBadge percent={off} className="absolute top-2.5 left-2.5" />}
        </div>
        <div className="px-0.5">
          <h3 className="line-clamp-2 text-sm leading-snug">{p.title}</h3>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-base font-semibold">{formatMoney(p.priceCents)}</span>
            {off >= 1 && (
              <s className="text-xs text-muted-foreground">
                <span className="sr-only">List price </span>
                {formatMoney(p.listPriceCents)}
              </s>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <StarIcon aria-hidden className="inline size-3 fill-star align-[-1px] text-star" />
            <span className="sr-only">Rated </span> {p.rating.toFixed(1)}
            <span className="sr-only"> out of 5</span> ·{" "}
            {p.stock > 0 ? <DeliveryDate dispatchDaysMin={p.dispatchDaysMin} dispatchDaysMax={p.dispatchDaysMax} /> : "Out of stock"}
          </p>
        </div>
      </Link>
      {/* Same square as the image, so the "+" sits in its corner without nesting a button in the link. */}
      {p.stock > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
          <QuickAdd productId={p.id} title={p.title} className="pointer-events-auto absolute right-2.5 bottom-2.5" />
        </div>
      )}
    </div>
  );
}
