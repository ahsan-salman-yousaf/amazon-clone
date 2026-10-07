import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { FilterGroups } from "@/components/search/filters";
import { PendingRegion, SearchStateProvider } from "@/components/search/search-state";
import { ActivePills, MobileFilters, SortSelect, type Pill } from "@/components/search/toolbar";
import { FAST_DISPATCH_DAYS, PAGE_SIZE, PRICE_BANDS, SORTS, parseFilters, searchProducts } from "@/lib/search";

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Search results and category pages share this view (owner decision: option A,
 * an always-visible filter sidebar). Everything is driven by the URL.
 */
export async function SearchResults({
  searchParams,
  category,
}: {
  searchParams: Promise<RawParams>;
  category?: { slug: string; name: string };
}) {
  const raw = await searchParams;
  const f = parseFilters(raw, category?.slug);
  const result = await searchProducts(f);
  const showDepartments = !category;

  const values = { brands: f.brands, price: f.price, minRating: f.minRating, fast: f.fast, inStock: f.inStock, category: category ? undefined : f.category };
  const facets = { brands: result.brands, departments: result.departments };

  const pills: Pill[] = [
    ...f.brands.map((b) => ({ key: `brand:${b}`, label: b, clear: { brand: f.brands.filter((x) => x !== b).join(",") || null } })),
    ...(f.category && !category
      ? [{ key: "cat", label: result.departments.find((d) => d.slug === f.category)?.name ?? f.category, clear: { cat: null } }]
      : []),
    ...(f.price ? [{ key: "price", label: PRICE_BANDS.find(([v]) => v === f.price)![1], clear: { price: null } }] : []),
    ...(f.minRating ? [{ key: "rating", label: `${f.minRating}★ & up`, clear: { rating: null } }] : []),
    ...(f.fast ? [{ key: "fast", label: "Fast delivery", clear: { fast: null } }] : []),
    ...(f.inStock ? [{ key: "stock", label: "In stock", clear: { stock: null } }] : []),
  ];

  const pages = Math.ceil(result.total / PAGE_SIZE);
  const heading = category ? category.name : f.q ? `“${f.q}”` : "All products";
  const filterProps = { values, facets, priceBands: PRICE_BANDS, fastDays: FAST_DISPATCH_DAYS, showDepartments };

  return (
    <SearchStateProvider>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {result.total} result{result.total === 1 ? "" : "s"}
            {f.q && category ? ` for “${f.q}” in` : f.q ? " for" : ""}
          </p>
          <h1 className="truncate text-2xl font-semibold tracking-tight lg:text-3xl">{heading}</h1>
          {result.relaxed && (
            <p className="mt-1 text-sm text-muted-foreground">
              No exact matches for every word. Showing results for {f.q.split(/\s+/).join(" or ")}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MobileFilters {...filterProps} activeCount={pills.length} total={result.total} />
          <SortSelect sort={f.sort} sorts={SORTS} />
        </div>
      </div>
      <ActivePills pills={pills} />

      <div className="mt-2 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        <aside aria-label="Filters" className="hidden pt-6 lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">
            <FilterGroups {...filterProps} />
          </div>
        </aside>

        <PendingRegion>
          {result.items.length ? (
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {result.items.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyResults hasFilters={pills.length > 0} q={f.q} />
          )}
          {pages > 1 && <Pagination page={f.page} pages={pages} raw={raw} />}
        </PendingRegion>
      </div>
    </SearchStateProvider>
  );
}

function EmptyResults({ hasFilters, q }: { hasFilters: boolean; q: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-input p-10 text-center">
      <p className="font-medium">{hasFilters ? "No products match these filters" : `Nothing found for “${q}”`}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters ? "Try removing a filter above." : "Check the spelling, or try a broader word."}
      </p>
      <Link href="/search" className="mt-4 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
        Browse all products
      </Link>
    </div>
  );
}

function Pagination({ page, pages, raw }: { page: number; pages: number; raw: RawParams }) {
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && k !== "page") qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `?${s}` : "?";
  };
  const link = "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${link} border border-input bg-white/70 hover:bg-white`}>
          Previous
        </Link>
      )}
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`${link} ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-black/5"}`}
        >
          {p}
        </Link>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className={`${link} border border-input bg-white/70 hover:bg-white`}>
          Next
        </Link>
      )}
    </nav>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-4 w-24 rounded bg-black/5" />
      <div className="mt-2 h-8 w-56 rounded-lg bg-black/5" />
      <div className="mt-8 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-5 rounded bg-black/5" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i}>
              <div className="aspect-square rounded-2xl bg-black/5" />
              <div className="mt-3 h-4 w-3/4 rounded bg-black/5" />
              <div className="mt-2 h-4 w-1/3 rounded bg-black/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
