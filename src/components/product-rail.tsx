import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { ProductCardData } from "@/lib/catalog";

/** Swipeable row on mobile, a five-up grid on desktop. */
export function ProductRail({
  title,
  subtitle,
  href,
  products,
}: {
  title: string;
  subtitle: string;
  href: string;
  products: ProductCardData[];
}) {
  const headingId = `rail-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="mt-14 lg:mt-20">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-xl font-semibold tracking-tight lg:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 rounded-md text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          See all <span className="sr-only">{title}</span>
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <li key={p.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
