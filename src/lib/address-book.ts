import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import type { AddressInput } from "@/lib/address";

export async function listAddresses(userId: string) {
  return db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

/** Creates or updates an address the user owns. The first address becomes the default. */
export async function upsertAddress(userId: string, a: AddressInput, opts: { id?: string; makeDefault?: boolean }) {
  const existing = await listAddresses(userId);
  const makeDefault = opts.makeDefault || existing.length === 0 || (existing.length === 1 && existing[0].id === opts.id);
  if (makeDefault) await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
  if (opts.id) {
    const [row] = await db
      .update(addresses)
      .set({ ...a, ...(makeDefault ? { isDefault: true } : {}) })
      .where(and(eq(addresses.id, opts.id), eq(addresses.userId, userId)))
      .returning({ id: addresses.id });
    return row?.id ?? null;
  }
  const [row] = await db.insert(addresses).values({ ...a, userId, country: "US", isDefault: makeDefault }).returning({ id: addresses.id });
  return row.id;
}

export async function deleteAddress(userId: string, id: string) {
  const [gone] = await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).returning({ wasDefault: addresses.isDefault });
  // Keep exactly one default while any address remains.
  if (gone?.wasDefault) {
    const [next] = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.createdAt)).limit(1);
    if (next) await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
  }
}

export async function setDefaultAddress(userId: string, id: string) {
  await db.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), ne(addresses.id, id)));
  await db.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
}
