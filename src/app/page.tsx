import { Button } from "@/components/ui/button";

// Skeleton home page so the live link exists early (PLAN.md Step 4.1).
// Replaced by the real storefront once the catalog is seeded.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
        <span className="text-xl font-extrabold tracking-tight">
          Olympus<span className="text-star">Cart</span>
        </span>
      </header>
      <section className="glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need, delivered by Friday.
        </h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          The storefront is being built. Search, product pages, cart and checkout are coming next.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="brand" size="lg">Shop deals</Button>
          <Button variant="outline" size="lg">Browse categories</Button>
        </div>
      </section>
    </main>
  );
}
