import Image from "next/image";
import Link from "next/link";
import { StarIcon } from "lucide-react";
import { DeliveryDate } from "@/components/delivery-date";
import type { ProductCardData } from "@/lib/catalog";
import { discountPercent, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Calm card: image, title, price, one line of rating + delivery (owner decision). */
export function ProductCard({ product: p, className }: { product: ProductCardData; className?: string }) {
  const off = discountPercent(p.priceCents, p.listPriceCents);
  return (
    <Link
      href={`/p/${p.slug}`}
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/80">
        <Image
          src={p.thumbnail}
          alt=""
          fill
          sizes="(min-width: 1024px) 220px, 45vw"
          className="object-contain p-4 transition-transform duration-300 ease-smooth group-hover:scale-[1.04]"
        />
        {off >= 5 && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-sale">
            -{off}%
          </span>
        )}
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
          <StarIcon aria-hidden className="inline size-3 fill-star text-star align-[-1px]" />
          <span className="sr-only">Rated </span> {p.rating.toFixed(1)}
          <span className="sr-only"> out of 5</span> · <DeliveryDate dispatchDaysMin={p.dispatchDaysMin} dispatchDaysMax={p.dispatchDaysMax} />
        </p>
      </div>
    </Link>
  );
}
