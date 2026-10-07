import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, StarIcon } from "lucide-react";
import { DeliveryDate } from "@/components/delivery-date";
import { ProductCard } from "@/components/product-card";
import { BuyBox } from "@/components/product/buy-box";
import { ProductGallery } from "@/components/product/gallery";
import { ViewTracker } from "@/components/product/view-tracker";
import { getAlsoViewed } from "@/lib/also-viewed";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { MobileBuyBar } from "@/components/product/mobile-buy-bar";
import { getAllProductSlugs, getCategories, getProduct, type ProductCardData } from "@/lib/catalog";
import { groupDepartments } from "@/lib/departments";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function generateStaticParams() {
  return getAllProductSlugs();
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const data = await getProduct((await params).slug);
  if (!data) return { title: "Product not found" };
  return { title: data.product.title, description: data.product.description.slice(0, 160) };
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={cn("size-[1em] fill-current", i <= Math.round(rating) ? "text-star" : "text-star/25")} />
      ))}
    </span>
  );
}


// Owner decision: option B, two columns, sticky gallery left, details + buy box right.
export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const data = await getProduct((await params).slug);
  if (!data) notFound();
  const { product: p, categoryName, reviews, related, variants } = data;
  const group = groupDepartments(await getCategories()).find((g) => g.categories.some((c) => c.slug === p.categorySlug));

  const specs: [string, string | null][] = [
    ["Brand", p.brand],
    ["Model / SKU", p.sku],
    ["Weight", p.weightGrams ? `${(p.weightGrams / 1000).toFixed(1)} kg` : null],
    ["Warranty", p.warranty],
    ["Returns", p.returnPolicy],
  ];

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 lg:px-8">
        <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-12">
          <div className="lg:sticky lg:top-24">
            <ProductGallery images={p.images} title={p.title} />
          </div>

          <div className="mt-6 lg:mt-0">
            <nav aria-label="Breadcrumb" className="mb-3">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {group && group.name !== categoryName && (
                  <li className="flex items-center gap-1">
                    {group.name}
                    <ChevronRightIcon aria-hidden className="size-3" />
                  </li>
                )}
                <li>
                  <Link href={`/c/${p.categorySlug}`} className="hover:text-foreground hover:underline">
                    {categoryName}
                  </Link>
                </li>
              </ol>
            </nav>
            {p.brand && <p className="text-sm font-medium text-muted-foreground">{p.brand}</p>}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance lg:text-3xl">{p.title}</h1>
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 rounded-md text-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
              <Stars rating={p.rating} className="text-sm" />
              <span className="font-medium">{p.rating.toFixed(1)}</span>
              <span className="sr-only">out of 5,</span>
              <span className="text-muted-foreground underline-offset-2 hover:underline">{p.ratingCount.toLocaleString("en-US")} ratings</span>
            </a>
            <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-foreground/85">{p.description}</p>

            <div className="mt-6">
              <BuyBox product={p} sizes={variants} />
            </div>
          </div>
        </div>

        <section aria-labelledby="specs" className="mt-14">
          <h2 id="specs" className="text-lg font-semibold tracking-tight">
            Specifications
          </h2>
          <dl className="mt-3 divide-y divide-border rounded-2xl bg-white/60 text-sm lg:max-w-3xl">
            {specs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </section>

        <ReviewsSection
          productId={p.id}
          rating={p.rating}
          ratingCount={p.ratingCount}
          reviews={reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        />

        <AlsoViewed productId={p.id} categoryName={categoryName} fallback={related} />
      </main>

      <ViewTracker productId={p.id} />
      <MobileBuyBar
        productId={p.id}
        needsSize={variants.length > 0}
        price={formatMoney(p.priceCents)}
        disabled={p.stock <= 0}
        delivery={<DeliveryDate dispatchDaysMin={p.dispatchDaysMin} dispatchDaysMax={p.dispatchDaysMax} />}
      />
    </>
  );
}

/** Real co-views when there are enough; otherwise an honestly labelled same-category rail. */
async function AlsoViewed({ productId, categoryName, fallback }: { productId: number; categoryName: string; fallback: ProductCardData[] }) {
  const viewed = await getAlsoViewed(productId);
  const items = viewed.fromViews ? viewed.items : fallback;
  if (!items.length) return null;
  const title = viewed.fromViews ? "Customers also viewed" : `More from ${categoryName}`;
  return (
    <section aria-labelledby="related" className="mt-16">
      <h2 id="related" className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {viewed.fromViews && <p className="mt-1 text-sm text-muted-foreground">Based on what other shoppers looked at alongside this item</p>}
      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((r) => (
          <li key={r.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none">
            <ProductCard product={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
