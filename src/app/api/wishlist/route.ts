import { currentUserId } from "@/auth";
import { wishlistIds } from "@/lib/wishlist";

/** Which products the signed-in shopper has saved, so hearts on static pages can show it. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ signedIn: false, ids: [] }, { headers: { "Cache-Control": "private, no-store" } });
  return Response.json({ signedIn: true, ids: await wishlistIds(userId) }, { headers: { "Cache-Control": "private, no-store" } });
}
