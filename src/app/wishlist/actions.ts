"use server";

import { refresh } from "next/cache";
import { currentUserId } from "@/auth";
import { addItem, getOrCreateCartId } from "@/lib/cart";
import { setWishlisted } from "@/lib/wishlist";

export type WishlistResult = { ok: true; saved: boolean } | { ok: false; reason: "signin" | "invalid" };

export async function toggleWishlist(productId: number, saved: boolean): Promise<WishlistResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, reason: "signin" };
  if (!Number.isInteger(productId) || productId <= 0) return { ok: false, reason: "invalid" };
  return { ok: true, saved: await setWishlisted(userId, productId, saved) };
}

/** Wishlist page: move one item into the cart. */
export async function moveWishlistToCart(productId: number) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, message: "Sign in to use your wishlist." };
  const qty = await addItem(await getOrCreateCartId(), productId, 1);
  if (!qty) return { ok: false as const, message: "That item is out of stock right now." };
  await setWishlisted(userId, productId, false);
  refresh();
  return { ok: true as const, message: "Moved to your cart" };
}
