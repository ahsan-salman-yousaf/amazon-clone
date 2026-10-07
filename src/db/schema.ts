import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Money is always integer cents, USD (owner decision, docs/PLAN.md).

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ---------- users & addresses ---------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("US"),
    phone: text("phone"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

/* ---------- catalog ---------- */

export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    brand: text("brand"),
    categorySlug: text("category_slug")
      .notNull()
      .references(() => categories.slug),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    sku: text("sku").notNull(),
    /** What the customer pays now. */
    priceCents: integer("price_cents").notNull(),
    /** Struck-through "list price"; equal to priceCents when there is no discount. */
    listPriceCents: integer("list_price_cents").notNull(),
    rating: real("rating").notNull(),
    ratingCount: integer("rating_count").notNull(),
    stock: integer("stock").notNull(),
    thumbnail: text("thumbnail").notNull(),
    images: text("images").array().notNull(),
    /** Business days before the item leaves the warehouse. */
    dispatchDaysMin: integer("dispatch_days_min").notNull(),
    dispatchDaysMax: integer("dispatch_days_max").notNull(),
    warranty: text("warranty"),
    returnPolicy: text("return_policy"),
    weightGrams: integer("weight_grams"),
    createdAt: createdAt(),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(${products.title}, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(${products.brand}, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(${products.categorySlug}, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(${products.description}, '')), 'C')`,
    ),
  },
  (t) => [
    index("products_search_idx").using("gin", t.search),
    index("products_category_idx").on(t.categorySlug),
    index("products_price_idx").on(t.priceCents),
    index("products_rating_idx").on(t.rating),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    comment: text("comment").notNull(),
    /** The author has a paid order containing this product. */
    verified: boolean("verified").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId),
    // One review per account per product (seeded reviews have no user).
    uniqueIndex("reviews_product_user_idx").on(t.productId, t.userId).where(sql`${t.userId} is not null`),
  ],
);

/* ---------- wishlist ---------- */

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

/* ---------- product views ("customers also viewed") ---------- */

// Anonymous: a random per-browser id, never linked to an account.
export const productViews = pgTable(
  "product_views",
  {
    visitorId: uuid("visitor_id").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.visitorId, t.productId] }), index("product_views_product_idx").on(t.productId)],
);

/* ---------- carts ---------- */

// A guest cart is a row whose id lives in an httpOnly cookie; it is merged
// into the user's cart on sign-in. A user has at most one cart.
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    savedForLater: boolean("saved_for_later").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.productId] })],
);

/* ---------- orders & payments ---------- */

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "payment_failed",
  "cancelled",
]);

export const shippingSpeed = pgEnum("shipping_speed", ["standard", "expedited", "next_day"]);

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-facing order number, e.g. OC-7K3P-92QX. */
    number: text("number").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatus("status").notNull().default("pending_payment"),
    shippingSpeed: shippingSpeed("shipping_speed").notNull(),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    estimatedDeliveryFrom: date("estimated_delivery_from").notNull(),
    estimatedDeliveryTo: date("estimated_delivery_to").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("orders_user_idx").on(t.userId, t.createdAt)],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    // Snapshots, so the order reads the same if the catalog changes later.
    title: text("title").notNull(),
    thumbnail: text("thumbnail").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);

/** Status timeline shown on the order details page. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatus("status").notNull(),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.at)],
);

/* ---------- returns ---------- */

export const returnStatus = pgEnum("return_status", ["requested", "refunded", "cancelled"]);
export const returnReason = pgEnum("return_reason", [
  "no_longer_needed",
  "damaged",
  "wrong_item",
  "not_as_described",
  "better_price",
  "other",
]);

export const returns = pgTable(
  "returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: returnStatus("status").notNull().default("requested"),
    reason: returnReason("reason").notNull(),
    note: text("note"),
    refundCents: integer("refund_cents").notNull(),
    /** Stripe refund id, or the simulated provider's reference. */
    refundRef: text("refund_ref"),
    createdAt: createdAt(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (t) => [index("returns_order_idx").on(t.orderId)],
);

export const returnItems = pgTable(
  "return_items",
  {
    returnId: uuid("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.returnId, t.productId] })],
);

export const paymentProvider = pgEnum("payment_provider", ["stripe", "simulated"]);
export const paymentStatus = pgEnum("payment_status", [
  "requires_payment",
  "processing",
  "succeeded",
  "failed",
  "refunded",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull(),
    /** Stripe PaymentIntent id, or the simulated provider's reference. */
    providerRef: text("provider_ref").unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: paymentStatus("status").notNull().default("requires_payment"),
    amountCents: integer("amount_cents").notNull(),
    /** Display only ("Visa ending 4242"); full card numbers are never stored. */
    cardBrand: text("card_brand"),
    cardLast4: text("card_last4"),
    failureMessage: text("failure_message"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);
