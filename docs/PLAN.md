# Plan: rebuild amazon.com in 24 hours

## The brief (8x assignment)
- Use amazon.com end to end first, taking screenshots, before writing code.
- Deliverables:
  - a **live link** that opens for anyone who isn't signed in as us
  - a **public repo** with `.agent-logs/` committed as we go
  - a walkthrough video of at most 5 minutes, with camera on
- Judged on: speed (how much working product), product judgement (what came first and what was left out), and UX/UI.

## Step 0: capture gate (must pass first)
1. Hooks are installed (`.claude/settings.json`, `.claude/hooks/agent_log.py`).
2. Canary session 1: `CAPTURE TEST — 8x assignment, <name>`. Confirm the PROMPT and RESPONSE land in `.agent-logs/`.
3. Canary session 2, a fresh `claude` process: send the same kind of canary and confirm it lands in a new file.
4. Write `CAPTURE-TEST.md` with:
   - tool and model
   - mechanism and config file
   - the log path(s)
   - both canary entries, raw
   - what didn't work first
5. Commit and push.

## Step 1: recon (no code)
- Browse amazon.com logged out and screenshot it into `recon/`:
  - home
  - category navigation
  - search results with filters and sort
  - product page (gallery, buy box, variants, delivery promise, reviews)
  - cart
  - the checkout entry (it forces sign-in)
- Sign-up, checkout, orders, returns and account need a real account. The owner does those flows and adds the screenshots to `recon/`.
- Output `recon/NOTES.md`: each flow, what's essential to it, what's friction, and what's an opportunity to beat Amazon.

## Step 2: product scope (what first, what's left out)

**P0, the core purchase loop. Ship this first, end to end and deployed:**
1. **Home:** search, category rails, deals, recently viewed.
2. **Search and browse:** keyword search (Postgres full-text), category, price, rating and Prime-style delivery filters, sorting, pagination.
3. **Product page:** image gallery, price and savings, rating summary, stock, delivery-date promise, quantity, Add to cart and Buy now.
4. **Cart:** change quantity, remove, save for later, subtotal, free-shipping progress.
5. **Auth:** sign up and sign in (email + password). Guests can browse; checkout requires sign-in, as on Amazon.
6. **Checkout:** one review page with shipping address, delivery speed, payment (Stripe Payment Element in test mode, or a simulated provider) and "Place your order".
7. **Orders:** confirmation page, order history and order details with a status timeline.

**P1, if time allows:** written reviews with star filters, lists/wishlist, addresses in the account, "customers also viewed", returns request.

**Deliberately out:** seller marketplace, Prime Video/Music, Alexa, ads, gift cards, real shipping and tax engines, multi-currency, recommendations ML.

**Where we try to beat Amazon:**
- an uncluttered product page with the buy box always visible
- an honest delivery date before the cart
- unit-price comparison in search results
- instant filters with no full page reloads
- a checkout that takes one page and three decisions

## Step 3: stack and architecture

**Stack:**
- **Next.js App Router** full stack: server components plus server actions and route handlers. This means one deployable on Vercel, with no separate API to host.
- **Postgres on Neon** through Drizzle ORM: typed schema, SQL migrations, and full-text search with `tsvector`.
- **Auth.js** with credentials and bcrypt; sessions in the database.
- **Stripe Payment Element** in test mode. The server re-prices the cart, creates a PaymentIntent with an idempotency key, and a webhook marks the order paid. If there are no Stripe keys, a `PaymentProvider` interface falls back to a simulated provider whose test cards succeed or decline.
- **Seed catalog:** about 200–300 products across 8–10 categories from an open demo dataset, with deterministic ratings, stock and delivery estimates.

**Data model:**
- users and sessions
- addresses
- categories
- products (with images)
- reviews
- carts and cart items (guest carts in a cookie, merged on sign-in)
- orders and order items
- payments (provider, intent, status)
- order status: `pending_payment → paid → shipped → delivered`, or `payment_failed`

## Step 4: delivery order
1. Scaffold the app, database, seed and catalog pages, then deploy a skeleton early so the live link exists from hour 1.
2. Search, filters and the product page.
3. Cart with the guest-to-user merge.
4. Auth.
5. Checkout and payments, then orders.
6. UI polish: run the `web-design-guidelines` audit, plus mobile, empty, loading and error states.
7. P1 features if time allows.
8. README, final deploy, and check it opens signed out.

## Decisions (owner, 2026-10-07)
- **Working rule:** follow this plan in order. The owner makes every decision; the agent asks first.
- **Name:** Olympus Cart.
- **Scope:** P0 stays as written above. P1 only if time allows.
- **Catalog:** DummyJSON (about 194 products, about 24 categories, with images, rating, stock and discount).
- **Payments:** Stripe **test mode** only (`pk_test_`/`sk_test_`); never live. The owner adds the keys to `.env` by the checkout step (Step 4.5). Until then the simulated provider stands in.
- **Hosting:** Vercel, with the owner running `vercel login`. Postgres on Neon.
- **Recon:** the agent captured the logged-out flows (`recon/`). The owner adds the signed-in flows in parallel.
- **Visual direction:** clean modern retail with glass surfaces (translucent panels and backdrop blur over soft colour fields).
  - Motion is smooth and fast: transitions of 150–450ms, no animations that delay loading, and everything off under `prefers-reduced-motion`.
- **UI kit:** shadcn/ui on **Radix** primitives, **Nova** preset (Lucide icons, Geist font). Compared in `docs/design/presets.html`.
- **Tooling:** pnpm, Next.js 16.4, Vercel CLI (the owner logs in), Neon added through the Vercel Marketplace.
- **Catalog rules:** no Amazon-branded products, so "Amazon Echo Plus" is excluded. Delivery dates stay honest even when they're far off; long dispatch times are not capped.
- **Search:** require all words first, then fall back to any word with a "showing results for …" note, plus prefix matching.
- **Images:** `next/image`, served unoptimized from DummyJSON's CDN, which stays clear of Vercel Hobby's image quota.
- **Home and header:** the refined search-first home (`docs/design/home-c.html`).
  - **Search:** only one search box is ever on screen. On home the hero search comes first, and a compact search fades into the header once the hero scrolls away. Other pages always show the header search.
  - **Header:** "All", logo, Sign in and Cart only. Departments live only in the "All" drawer, grouped into six sections.
  - **Rails:** two calm product rails (Today's deals, Top rated) and a "Browse all departments" button.
  - **Cards:** image, title, price and one line with the rating and delivery date, with a small round "+" to add to cart.
- **Search results:** option A from `docs/design/search-and-product.html`.
  - **Filters:** a sidebar that is always visible, covering Delivery, Rating, Price, Brand and Department. Changes apply instantly, without reloading the page.
  - **Results:** active filters show as removable pills, with five sort options.
  - **Mobile:** a filter bottom sheet with a "Show N results" button.
- **Product page:** option B.
  - **Layout:** a large sticky gallery on the left, with details and the buy box on the right. Specs, reviews and related products run full width below.
  - **Mobile:** a bottom bar fixed to the screen, with price and Add to cart.
- **Shipping:** standard delivery (2 business days in transit) is free on orders of $35 or more, and $5.99 below that. Express (1 business day in transit) is $9.99 flat. The cart shows free-delivery progress.
- **Cart extras in P0:** Save for later only. Per-item delivery dates in the cart and a recently viewed rail are left out.
- **Auth:** Auth.js v5 with the Credentials provider, JWT sessions and bcrypt.
  - **Page:** a single `/signin` page with "Sign in | Create account" tabs, email and password on one screen.
  - **Passwords:** at least 8 characters, with a show/hide toggle.
  - **Demo account:** a one-click "Try the demo account" button, with its credentials shown on the page.
  - **After sign-in:** the guest cart merges into the account and the shopper returns to where they were.
- **Checkout:** one page with three decisions: address, delivery speed and payment.
  - **Payment:** the Stripe Payment Element in **test mode**, live since 2026-10-07. Live keys are refused. If the keys are missing, checkout falls back to the clearly labelled simulated provider, which accepts test cards only.
  - **Webhook:** `/api/stripe/webhook`, receiving payment_intent.succeeded and payment_intent.payment_failed.
  - **Tax:** a flat estimated 8%.
  - **Address:** US only, saved to the account and prefilled next time. The demo account gets a sample address.
- **Deploy:** the next production deploy happens once checkout works end to end.
- **Colour scheme:** *Graphite Coral*, chosen from `docs/design/color-schemes.html`. Every pair passes WCAG AA.

  | Token | Value | Use |
  |---|---|---|
  | `bg` | `#F6F6F4` | page background |
  | `ink` | `#16181D` | body text, focus ring |
  | `muted` | `#545862` | secondary text |
  | `primary` / `on-primary` | `#16181D` / `#FFFFFF` | Buy now, cart, dark buttons |
  | `accent` / `on-accent` | `#FF5A4E` / `#16181D` | Add to cart, search, main calls to action (5.77:1) |
  | `star` | `#C2410C` | star ratings |
  | `sale` | `#B42318` | discount % |
  | `stock` | `#1F7A3A` | in stock |
  | `blob1` / `blob2` | `#FFC2BC` / `#BFD4FF` | blurred colour fields behind the glass |
  | `surface` / `border` | `rgba(255,255,255,.58)` / `rgba(18,18,31,.10)` | glass panels |
