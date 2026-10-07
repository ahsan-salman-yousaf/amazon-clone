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

## Open decisions (owner)
- **Hosting:** `vercel login` (preferred) or a temporary deployment.
- **Payments:** Stripe test keys, or the simulated provider.
- **Account recon:** the owner screenshots sign-up, checkout and orders on a real account.
