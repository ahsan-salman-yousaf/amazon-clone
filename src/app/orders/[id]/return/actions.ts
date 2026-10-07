"use server";

import { redirect } from "next/navigation";
import { currentUserId } from "@/auth";
import { createReturn } from "@/lib/returns";

export type ReturnFormState = { error: string; field?: "items" | "reason" | "note" } | null;

export async function requestReturnAction(_prev: ReturnFormState, fd: FormData): Promise<ReturnFormState> {
  const userId = await currentUserId();
  const orderId = String(fd.get("orderId") ?? "");
  if (!userId) redirect(`/signin?next=/orders/${orderId}/return`);
  const items = fd
    .getAll("item")
    .map(String)
    .map((productId) => ({ productId: Number(productId), quantity: Number(fd.get(`qty-${productId}`) ?? 1) }))
    .filter((i) => Number.isInteger(i.productId) && Number.isInteger(i.quantity));
  const result = await createReturn({ userId, orderId, items, reason: String(fd.get("reason") ?? ""), note: String(fd.get("note") ?? "") });
  if (!result.ok) return { error: result.error, field: result.field };
  redirect(`/orders/${orderId}?return=requested`);
}
