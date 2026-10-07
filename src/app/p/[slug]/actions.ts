"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/auth";
import { getOwnReview, saveReview } from "@/lib/reviews";

export type ReviewFormState = {
  ok?: true;
  updated?: boolean;
  verified?: boolean;
  review?: { rating: number; title: string; comment: string; verified: boolean };
  signin?: true;
  error?: string;
  fieldErrors?: Partial<Record<"rating" | "title" | "comment", string>>;
} | null;

const schema = z.object({
  productId: z.coerce.number().int().positive(),
  rating: z.coerce.number({ error: "Choose a star rating" }).int().min(1, "Choose a star rating").max(5),
  title: z.string().trim().min(3, "Give your review a short headline (3+ characters)").max(80, "Keep the headline under 80 characters"),
  comment: z.string().trim().min(20, "Tell other shoppers a bit more (at least 20 characters)").max(2000, "Keep it under 2,000 characters"),
});

export async function submitReviewAction(_prev: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  const userId = await currentUserId();
  if (!userId) return { signin: true };
  const parsed = schema.safeParse({ productId: fd.get("productId"), rating: fd.get("rating") ?? 0, title: fd.get("title"), comment: fd.get("comment") });
  if (!parsed.success) {
    const fieldErrors: NonNullable<ReviewFormState>["fieldErrors"] = {};
    for (const i of parsed.error.issues) fieldErrors[i.path[0] as "rating" | "title" | "comment"] ??= i.message;
    return { fieldErrors };
  }
  const saved = await saveReview({ userId, ...parsed.data });
  // Stale-while-revalidate: cached pages keep serving and refresh in the background
  // (a blocking refresh would break prerendered pages). The author sees their
  // review immediately on the client.
  revalidateTag(`product:${saved.slug}`, "max");
  revalidateTag("catalog", "max");
  return { ok: true, updated: saved.updated, verified: saved.verified, review: { ...parsed.data, verified: saved.verified } };
}

/** Prefills the form when the shopper already reviewed this product. */
export async function ownReviewAction(productId: number) {
  const userId = await currentUserId();
  if (!userId) return { signedIn: false as const };
  return { signedIn: true as const, review: await getOwnReview(userId, productId) };
}
