"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { addItem, cartCount, getOrCreateCartId, readCartId, removeItem, setQuantity, setSavedForLater } from "@/lib/cart";

export type AddToCartState = { ok: boolean; message: string; count?: number } | null;

function parse(formData: FormData) {
  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!Number.isInteger(productId) || productId <= 0) return null;
  return { productId, quantity: Number.isFinite(quantity) ? quantity : 1 };
}

export async function addToCart(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const input = parse(formData);
  if (!input) return { ok: false, message: "That product couldn't be found." };
  const cartId = await getOrCreateCartId();
  const lineQty = await addItem(cartId, input.productId, input.quantity);
  if (lineQty === 0) return { ok: false, message: "Sorry, this item is out of stock." };
  const count = await cartCount(cartId);
  refresh();
  return { ok: true, message: `Added to cart · ${lineQty} in cart`, count };
}

export async function buyNow(formData: FormData) {
  const input = parse(formData);
  if (!input) return;
  const cartId = await getOrCreateCartId();
  await addItem(cartId, input.productId, input.quantity);
  // Checkout requires sign-in (as on Amazon); the cart page routes there.
  redirect("/cart");
}

/** Cart page edits. Each works on the cookie's cart only, so ids can't reach other carts. */
async function withLine(formData: FormData, fn: (cartId: string, productId: number) => Promise<void>) {
  const input = parse(formData);
  const cartId = await readCartId();
  if (!input || !cartId) return;
  await fn(cartId, input.productId);
  refresh();
}

export async function updateQuantity(formData: FormData) {
  await withLine(formData, (c, p) => setQuantity(c, p, Number(formData.get("quantity"))));
}
export async function removeFromCart(formData: FormData) {
  await withLine(formData, removeItem);
}
export async function saveForLater(formData: FormData) {
  await withLine(formData, (c, p) => setSavedForLater(c, p, true));
}
export async function moveToCart(formData: FormData) {
  await withLine(formData, (c, p) => setSavedForLater(c, p, false));
}
