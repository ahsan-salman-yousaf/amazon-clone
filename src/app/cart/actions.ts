"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { listVariants } from "@/lib/catalog";
import { addItem, addItemChecked, cartCount, getCartView, getOrCreateCartId, readCartId, removeItem, setQuantity, setSavedForLater } from "@/lib/cart";

export type AddToCartState = { ok: boolean; message: string; count?: number; needsSize?: boolean } | null;

function parse(formData: FormData) {
  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity") ?? 1);
  const variantRaw = formData.get("variantId");
  const variantId = variantRaw ? Number(variantRaw) : null;
  if (!Number.isInteger(productId) || productId <= 0) return null;
  if (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) return null;
  return { productId, quantity: Number.isFinite(quantity) ? quantity : 1, variantId };
}

const REASONS = {
  size_required: "Choose a size first.",
  invalid_size: "That size isn't available for this product. Choose another one.",
  out_of_stock: "Sorry, that's out of stock right now.",
} as const;

export async function addToCart(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const input = parse(formData);
  if (!input) return { ok: false, message: "That product couldn't be found." };
  const cartId = await getOrCreateCartId();
  const r = await addItemChecked(cartId, input.productId, input.quantity, input.variantId);
  if (!r.ok) return { ok: false, message: REASONS[r.reason], needsSize: r.reason === "size_required" };
  const count = await cartCount(cartId);
  refresh();
  return { ok: true, message: `Added to cart · ${r.quantity} in cart`, count };
}

export async function buyNow(formData: FormData) {
  const input = parse(formData);
  if (!input) return;
  const cartId = await getOrCreateCartId();
  const r = await addItemChecked(cartId, input.productId, input.quantity, input.variantId);
  if (!r.ok) return; // the form shows "Choose a size first" before it gets here
  // Checkout requires sign-in (as on Amazon); the cart page routes there.
  redirect("/cart");
}

/** Cart page edits address one line (product + size) of the caller's own cart. */
async function withLine(formData: FormData, fn: (cartId: string, lineId: number) => Promise<unknown>) {
  const lineId = Number(formData.get("lineId"));
  const cartId = await readCartId();
  if (!Number.isInteger(lineId) || lineId <= 0 || !cartId) return;
  await fn(cartId, lineId);
  refresh();
}

export async function updateQuantity(formData: FormData) {
  await withLine(formData, (c, l) => setQuantity(c, l, Number(formData.get("quantity"))));
}
export async function removeFromCart(formData: FormData) {
  await withLine(formData, removeItem);
}
export async function saveForLater(formData: FormData) {
  await withLine(formData, (c, l) => setSavedForLater(c, l, true));
}
export async function moveToCart(formData: FormData) {
  await withLine(formData, (c, l) => setSavedForLater(c, l, false));
}

/** Undo for "Remove": puts the line back with its size, quantity and saved state. */
export async function restoreLine(productId: number, variantId: number | null, quantity: number, saved: boolean) {
  const cartId = await readCartId();
  if (!cartId || !Number.isInteger(productId) || productId <= 0) return;
  await addItem(cartId, productId, quantity, variantId);
  if (saved) {
    const view = await getCartView(cartId);
    const back = view.lines.find((l) => l.productId === productId && l.variantId === variantId);
    if (back) await setSavedForLater(cartId, back.lineId, true);
  }
  refresh();
}

/** Sizes for the quick-add popover on product cards. */
export async function getSizes(productId: number) {
  if (!Number.isInteger(productId) || productId <= 0) return [];
  return listVariants(productId);
}
