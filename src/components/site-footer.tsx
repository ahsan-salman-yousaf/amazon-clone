import Link from "next/link";

const columns = [
  {
    title: "Shop",
    links: [
      ["Today's deals", "/search?sort=discount"],
      ["Top rated", "/search?sort=rating"],
      ["All products", "/search"],
    ],
  },
  {
    title: "Your account",
    links: [
      ["Your orders", "/orders"],
      ["Returns & refunds", "/orders"],
      ["Wishlist", "/wishlist"],
      ["Account & addresses", "/account"],
    ],
  },
  {
    title: "Olympus Cart",
    links: [
      ["About us", "/about"],
      ["Contact us", "/contact"],
    ],
  },
] as const;

/** Calm footer, shown on the home page only (owner decision): About, Contact and account links. */
export function SiteFooter() {
  return (
    <footer className="px-3 pb-3">
      <div className="glass mx-auto max-w-7xl rounded-3xl px-6 py-8 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="rounded-md text-lg font-bold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
              Olympus<span className="text-star">Cart</span>
            </Link>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">Clear prices, honest delivery dates and a checkout that takes three steps.</p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{col.title}</h2>
              <ul className="mt-3 flex flex-col gap-1">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="-mx-2 inline-flex rounded-lg px-2 py-1 text-sm transition-colors hover:bg-brand hover:text-brand-foreground focus-visible:bg-brand focus-visible:text-brand-foreground focus-visible:outline-none"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">
          © 2026 Olympus Cart · Demo project, not affiliated with Amazon · Payments run in Stripe test mode, so no real money moves.
        </p>
      </div>
    </footer>
  );
}
