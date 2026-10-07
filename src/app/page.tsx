import { ProductRail } from "@/components/product-rail";
import { SiteFooter } from "@/components/site-footer";
import { SearchForm } from "@/components/search-form";
import { BrowseDepartmentsButton } from "@/components/browse-departments-button";
import { getDeals, getTopRated } from "@/lib/catalog";
import { HERO_SEARCH_ID } from "@/lib/ui-ids";

// Search-first home: one headline, one search, two calm rails (owner decision).
// The site footer lives on home only (owner decision); other pages link About/Contact from the All drawer.
export default async function Home() {
  const [deals, topRated] = await Promise.all([getDeals(), getTopRated()]);

  return (
    <>
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 lg:px-8">
      <section className="pt-16 pb-4 text-center lg:pt-28 lg:pb-8">
        <h1 className="mx-auto max-w-2xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance lg:text-6xl">
          What are you shopping for today?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Clear prices, and a real delivery date before you check out.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <SearchForm size="lg" id={HERO_SEARCH_ID} />
        </div>
      </section>

      <ProductRail title="Today's deals" subtitle="Biggest price drops right now" href="/search?sort=discount" products={deals} />
      <ProductRail title="Top rated" subtitle="Loved by thousands of shoppers" href="/search?sort=rating" products={topRated} />

      <div className="mt-20 text-center">
        <BrowseDepartmentsButton />
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
