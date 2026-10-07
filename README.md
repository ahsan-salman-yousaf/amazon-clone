# Olympus Cart

A working rebuild of Amazon's core shopping loop: browse, search, product pages, cart, sign-in, checkout and orders. It was built and deployed inside a 24-hour window.

**Live:** https://olympus-cart.vercel.app

> **Demo project, not affiliated with Amazon.** Olympus Cart uses its own name and look, never asks for Amazon credentials, and takes payments in **Stripe test mode** only. No real money moves.

## Try it in two minutes

1. Open the [live site](https://olympus-cart.vercel.app), search for something (e.g. "phone") and add a product to your cart.
2. Open the cart and choose **Proceed to checkout**. On the sign-in page, choose **Try the demo account**, or create an account.
   Demo account: `demo@olympuscart.example` / `olympus-demo`. It comes with two backdated, already-delivered sample orders (`OC-DEMO-*`), so you can try a **return** straight away.
3. Go through the three checkout steps, then pay with a Stripe test card:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 9995` | Declined: insufficient funds |
| `4000 0000 0000 0069` | Declined: expired card |
| `4000 0000 0000 0002` | Declined: generic decline |

For any card, use a future expiry date (e.g. `12/29`) and any 3-digit CVC. After paying, you land on the order confirmation, which has a status timeline; **Your orders** in the account menu lists every order.

## What's built (P0: the full purchase loop, end to end)

| Area | What it does |
|---|---|
| **Home** | Search-first hero, with "Today's deals" and "Top rated" rails of real products. Departments sit in an **All** drawer grouped into six sections, and only one search box is ever on screen. |
| **Search & browse** | Postgres full-text search that matches every word first and falls back to any word, with prefix and substring matching. Filters (delivery speed, department, rating, price, brand) apply instantly and are kept in the URL. Also: removable filter pills, 5 sort orders, pagination, and a filter bottom sheet on mobile. |
| **Product page** | Sticky gallery (swipe or tap on mobile), price and savings, a **delivery date shown before the cart**, stock status, quantity, Add to cart / Buy now, specs, reviews and related products. All 183 product pages are pre-rendered. |
| **Cart** | Guest carts are kept in the database and **merge into your account when you sign in**. Change quantity, remove (with **Undo**), save for later, see the subtotal and a free-delivery progress bar. |
| **Auth** | Email and password on one screen, with Sign in / Create account tabs, a one-click demo account, and a return to where you were after signing in. |
| **Checkout** | Ships within the **USA only** (shown in the header, on product pages and at checkout). Three guided steps (address → delivery → payment) with an animated stepper. The address is saved to your account, delivery is Standard or Express with real dates, and tax is an estimated 8%. Errors are specific to what went wrong (e.g. "declined for insufficient funds"). |
| **Payments** | Stripe Payment Element in test mode. The server re-prices the cart, reserves stock in a transaction and creates the PaymentIntent with an idempotency key. The order is marked paid only after the server checks with Stripe, and a signed webhook records the result as well. Live keys are refused. |
| **Orders** | Confirmation page, order details with a status timeline, and order history. The status moves on its own: shipped a few minutes after payment, then delivered on the estimated date. |

**Also built (P1):**

| Area | What it does |
|---|---|
| **Returns** | Request a return from order details: choose items and quantities, then a reason. Each product's own return window applies (e.g. "90 days return policy"). The refund (items plus their tax) is issued about 2 minutes later, as a real Stripe test-mode refund for Stripe orders, and the stock goes back on sale. |
| **Written reviews** | Signed-in shoppers write one review per product (stars, headline, text); writing again edits it. Buyers get a **Verified purchase** badge. Star filters, and the rating updates when you post. |
| **Wishlist** | A heart on every card and product page, plus a `/wishlist` page with Move to cart. |
| **Account & addresses** | `/account`: edit your name; add, edit, delete (with confirmation) and set a default address. Checkout lets you pick a saved address. |
| **Sizes** | Shoes (US men's and women's sizes), clothing (XS–XXL) and watches (band S/M/L) have sizes, each with its own stock. Sold-out sizes are crossed out, low sizes say "Only N left", and a **Size guide** chart opens from the product page. The "+" on a card opens a size picker. Cart, checkout, orders and returns all show the size. |
| **Customers also viewed** | Built from real, anonymous per-browser view sessions. Until there is enough data, the rail is honestly labelled "More from {category}". |

Accessibility is built in from the start:
- keyboard navigation, visible focus rings and a skip link
- real labels on every form field
- every colour pair checked against WCAG AA
- motion turned off under `prefers-reduced-motion`
- every page works at 360px wide

### Where it tries to beat Amazon
- **Honest delivery dates** on every card and product page, before the cart. Dates are computed in the shopper's timezone.
- **One clear price and an always-visible buy box.** No Prime-only "deal price" in the way of Add to cart.
- **A calm, uncluttered layout:** no sponsored blocks, and search results always show the price and delivery date.
- **Filters that apply instantly** without reloading the page.
- **Checkout in three short steps**, with errors that say exactly what to fix.

### Deliberately left out
- Seller marketplace, Prime Video and Music, Alexa, ads and gift cards
- Real shipping and tax engines: a flat estimated 8% tax and two shipping speeds stand in for them
- Multi-currency (USD only) and US-only shipping
- ML recommendations: "You might also like" shows top-rated products from the same category


## Stack

- **Next.js 16** (App Router, Cache Components, Server Actions), TypeScript, Tailwind CSS v4 and shadcn/ui (Radix base, Nova preset)
- **Postgres on Neon** through **Drizzle ORM**, with SQL migrations in `drizzle/`
- **Auth.js v5** (email and password, bcrypt, JWT sessions)
- **Stripe** (Payment Element and webhooks, test mode only)
- Deployed on **Vercel**. Catalog data comes from the open [DummyJSON](https://dummyjson.com) demo dataset (183 products, 22 categories).

Prices are stored as integer cents. Catalog reads are cached for an hour. Checkout takes stock and creates the order in a single database transaction, so stock can't be oversold, and both the browser and the webhook can report a payment without it being recorded twice.

```
src/app          routes: home, search, c/[slug], p/[slug], cart, signin, checkout, orders, api/stripe/webhook
src/components   UI (header and drawer, product card, search filters, checkout steps, cart lines…)
src/lib          domain logic: catalog, search, cart, orders, pricing, delivery dates, payments
src/db           Drizzle schema, HTTP client and transaction helper
scripts/seed.mts DummyJSON → Postgres seed (safe to re-run), plus the demo account
```

## Run it locally

Requirements: Node 22.6 or newer (the seed script uses built-in TypeScript stripping), pnpm, a Postgres database (Neon recommended) and, optionally, Stripe test keys.

```bash
pnpm install
cp .env.example .env.local      # fill in DATABASE_URL(s) and AUTH_SECRET; Stripe keys are optional
pnpm db:migrate                 # create tables
pnpm db:seed                    # load the catalog and the demo account
pnpm dev                        # http://localhost:3000
```

Every environment variable is documented in [`.env.example`](.env.example). Without Stripe keys, checkout falls back to a clearly labelled **simulated** provider that accepts the test cards above and refuses real card numbers.

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js development / production |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed or refresh the catalog and the demo account |

## How it was built

- **Plan:** the scope, priorities and every product decision (with the reason for it) are in [docs/PLAN.md](docs/PLAN.md).
- **Design:** the colour, layout and component options that were compared before building are in [docs/design/](docs/design/).
- **Recon:** screenshots and notes from studying amazon.com are in [recon/](recon/).
- **Session logs:** development prompts and responses are recorded in [`.agent-logs/`](.agent-logs/), as the brief requires. The capture check is in [CAPTURE-TEST.md](CAPTURE-TEST.md).
