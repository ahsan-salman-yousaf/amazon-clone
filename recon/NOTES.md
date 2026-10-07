# Recon notes: amazon.com, logged out

Captured on 2026-10-07 with a Playwright browser at 1440×900 and 390×844, logged out. The site detected the location as Pakistan, so prices are in PKR and include large import charges. I took screenshots only and copied no catalog data.

| File | What |
|---|---|
| `01-home.png` | Home, full page |
| `02-category-nav.png` | "All" category drawer open |
| `03-search-results.png`, `03b-search-above-fold.png` | Search for "wireless headphones": full page and above the fold |
| `04-product-above-fold.png`, `04b-product-full.png`, `04c-product-buybox.png` | Product page: the deal-price buy box, the full page, and the regular-price buy box with Add to cart and Buy Now |
| `05-cart-empty.png` | Cart, empty and logged out |
| `06-signin.png` | Sign-in / create-account entry |
| `07-mobile-product.png` | Product page at 390px wide (still the desktop layout) |

**Gaps:**
- **Filled cart, and the checkout redirect to sign-in.** These weren't captured. Adding an item to a real Amazon cart was blocked by the agent's permission check, and I didn't work around it. The owner's account screenshots can cover this, or the browser step can be re-run with permission.
- **Signed-in flows.** Sign-up, checkout, orders, returns and account are left to the owner (see the end of this file).

---

## 1. Home (`01`)
**Essential:**
- The header: logo, "Deliver to <location>", a department dropdown joined to the search box, account, Returns & Orders, and the cart count.
- A secondary nav row: All, deals, gift cards, and so on.
- The hero carousel.
- A 4-column grid of category cards. Each card has 4 sub-category tiles: Electronics, PCs, Fitness, Apparel under $25, Home, and so on.
- A "See personalized recommendations / Sign in" block, and a large footer.

**Friction:**
- A delivery-country popover covers the nav on first load.
- The hero is purely promotional and links to more browsing, not to products.
- Logged out, there are no real products on the home page at all, only category tiles.
- The header also has an "Agent Search" button next to Go.

**Opportunity:** show real products on home (deals, best sellers per category, recently viewed) so you can reach a product page in one click.

## 2. Category navigation (`02`)
**Essential:** a left drawer with "Hello, sign in", then sections: Digital Content & Devices, Shop by Department (Electronics, Computers, Smart Home, Arts & Crafts, then "See all"), Programs & Features, and Help & Settings. Sub-levels slide in.

**Friction:**
- Department links are buried under Amazon's own digital products.
- Only 4 departments show before "See all".
- The drawer covers the whole page.

**Opportunity:** a flat list of departments that are visible straight away, as a row in the header or a short drawer. Our catalog will only have 8–10 categories, so they all fit.

## 3. Search results (`03`, `03b`)
**Essential:**
- A results count and a "Sort by" dropdown with: Featured, Price low→high, Price high→low, Avg. Customer Review, Newest Arrivals, Best Sellers.
- A left filter rail: Deals & Discounts, Customer Reviews (4★ & up), Brands (checkboxes, plus "See more"), and attribute facets (Wireless Technology, Connectivity, Noise Control, …).
- Result rows with: image, title, a subtitle of bullets, a badge ("Overall Pick", "Top Reviewed for Battery life"), rating with count, "10K+ bought in past month", price with strikethrough list price, delivery date and cost, colour swatches, and a "See options" button.

**Friction:**
- The first result has **no price**, only "See options".
- There's no add-to-cart from the results.
- Delivery cost and date only appear on some rows.
- Titles are very long and full of keywords.
- Each filter click reloads the whole page.
- There's no unit price on this category.

**Opportunity:**
- show price and delivery date on every card
- instant client-side filters synced to the URL
- quick add to cart from the results
- short titles
- unit price where it makes sense

## 4. Product page (`04`, `04b`, `04c`)
**Essential:**
- Breadcrumb trail.
- A vertical thumbnail strip (images, a "4+" overflow, and videos) beside the main image.
- Title, brand store link, rating and count, an "Amazon's Choice" badge, and "1K+ bought in past month".
- Price block: % off, price, and a strikethrough list price.
- Variant swatches, each showing its own price.
- A spec table: Brand, Color, Ear placement, …
- Sections: About this item (bullets), product description, comparison table, From the brand, and Product information.
- Ratings: 117,860 total, with a breakdown by star level.
- **Buy box** on the right:
  - a choice between Deal price, Regular price and Used – Like New
  - shipping and import charges
  - the delivery date ("Friday, October 16")
  - "Deliver to Pakistan"
  - stock urgency ("Only 5 left in stock – order soon")
  - a quantity dropdown, then **Add to cart** (yellow) and **Buy Now** (orange)
  - Ships from / Sold by / Returns (30-day refund) / Gift options

**Friction:**
- By default the buy box shows a Prime-only deal with "Join Prime" as its main button. To get to Add to cart you first have to pick "Regular Price".
- A sponsored brand banner sits above the breadcrumb.
- Sponsored "Related items" and "Explore more" carousels come before the product description.
- The full page is about 11,300px tall.
- At 390px wide it serves the desktop layout, with the title and buy box cut off on the right edge (`07`).

**Opportunity:**
- a single clear price, with Add to cart always visible (sticky on desktop, a bottom bar on mobile)
- the delivery date shown near the price
- no sponsored blocks
- a page that's responsive from 360px up
- the reviews summary pulled up the page

## 5. Cart (`05`, empty)
**Essential:**
- An empty state: "Your Amazon Cart is empty", a "Shop today's deals" link, and "Sign in to your account" / "Sign up now" buttons.
- A note that prices are subject to change.
- A "Customers who bought items in your recent history also bought" rail.

**Friction:** the empty state sends you to deals rather than back to what you were browsing, and a sign-in popover overlaps the header.

**Opportunity:** an empty state that offers recently viewed items and continue shopping. The filled cart is still to be captured (see Gaps).

## 6. Sign-in entry (`06`)
**Essential:**
- A single combined step, "Sign in or create account". It asks for a mobile number or email, then Continue.
- Terms text, "Need help?", and "Create a free business account".
- A minimal chrome with no store header.

**Friction:** the flow takes several steps (identifier first, password on the next screen).

**Opportunity:** email and password on one screen, with a toggle between sign-in and sign-up. After signing in, return straight to checkout with the cart kept (merging the guest cart).

---

## Owner: signed-in flows (to add)
Please drop screenshots into `recon/` with these names, and I'll add a section for each one:
- `10-signup*.png`: account creation
- `11-cart-filled*.png`: a cart with items (quantity, save for later, subtotal)
- `12-checkout*.png`: every checkout step up to just before "Place your order". Please don't place a real order.
- `13-orders*.png`: order history and order details or tracking
- `14-returns*.png`: the return request flow
- `15-account*.png`: the Your Account hub and addresses

Blur or crop out personal data (name, address, card, order numbers) before committing. The repo is public.
