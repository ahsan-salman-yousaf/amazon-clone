import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, StarIcon } from "lucide-react";
import { DeliveryDate } from "@/components/delivery-date";
import { ProductCard } from "@/components/product-card";
import { BuyBox } from "@/components/product/buy-box";
import { ProductGallery } from "@/components/product/gallery";
import { MobileBuyBar } from "@/components/product/mobile-buy-bar";
import { getAllProductSlugs, getCategories, getProduct } from "@/lib/catalog";
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

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// Owner decision: option B, two columns, sticky gallery left, details + buy box right.
export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const data = await getProduct((await params).slug);
  if (!data) notFound();
  const { product: p, categoryName, reviews, related } = data;
  const group = groupDepartments(await getCategories()).find((g) => g.categories.some((c) => c.slug === p.categorySlug));

  const specs: [string, string | null][] = [
    ["Brand", p.brand],
    ["Model / SKU", p.sku],
    ["Weight", p.weightGrams ? `${(p.weightGrams / 1000).toFixed(1)} kg` : null],
    ["Warranty", p.warranty],
    ["Returns", p.returnPolicy],
  ];
  const dist = [5, 4, 3, 2, 1].map((s) => [s, reviews.filter((r) => r.rating === s).length] as const);

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
                {group && (
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
              <BuyBox product={p} />
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

        <section id="reviews" aria-labelledby="reviews-heading" className="mt-16 scroll-mt-24 lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
          <div>
            <h2 id="reviews-heading" className="text-lg font-semibold tracking-tight">
              Customer reviews
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-4xl font-semibold">{p.rating.toFixed(1)}</span>
              <div>
                <Stars rating={p.rating} className="text-base" />
                <p className="text-xs text-muted-foreground">{p.ratingCount.toLocaleString("en-US")} ratings</p>
              </div>
            </div>
            {reviews.length > 0 && (
              <>
                <ul className="mt-4 flex flex-col gap-1.5" aria-label="Written reviews by star rating">
                  {dist.map(([s, n]) => {
                    const pct = Math.round((n / reviews.length) * 100);
                    return (
                      <li key={s} className="flex items-center gap-2 text-xs">
                        <span className="w-10">{s} star</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                          <span className="block h-full rounded-full bg-star" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-8 text-right text-muted-foreground tabular-nums">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Breakdown of {reviews.length} written review{reviews.length === 1 ? "" : "s"}
                </p>
              </>
            )}
          </div>
          <ul className="mt-8 flex flex-col divide-y divide-border lg:mt-0">
            {reviews.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    {r.authorName
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <span className="font-medium">{r.authorName}</span>
                  <span className="text-muted-foreground">· {dateFmt.format(r.createdAt)}</span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs">
                  <Stars rating={r.rating} />
                  <span className="sr-only">{r.rating} out of 5 stars</span>
                </p>
                <p className="mt-1 text-sm">{r.comment}</p>
              </li>
            ))}
            {reviews.length === 0 && <li className="text-sm text-muted-foreground">No written reviews yet.</li>}
          </ul>
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-16">
            <h2 id="related" className="text-lg font-semibold tracking-tight">
              You might also like
            </h2>
            <ul className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
              {related.map((r) => (
                <li key={r.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none">
                  <ProductCard product={r} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <MobileBuyBar
        productId={p.id}
        price={formatMoney(p.priceCents)}
        disabled={p.stock <= 0}
        delivery={<DeliveryDate dispatchDaysMin={p.dispatchDaysMin} dispatchDaysMax={p.dispatchDaysMax} />}
      />
    </>
  );
}
