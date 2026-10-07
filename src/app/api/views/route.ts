import { cookies } from "next/headers";
import { recordView } from "@/lib/also-viewed";

const VISITOR_COOKIE = "oc_vid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records an anonymous product view for "Customers also viewed". The visitor
 * id is random, per browser, and never linked to an account.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = Number(body?.productId);
  if (!Number.isInteger(productId) || productId <= 0) return new Response(null, { status: 400 });

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value ?? "";
  if (!UUID.test(visitorId)) {
    visitorId = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  }
  try {
    await recordView(visitorId, productId);
  } catch {
    return new Response(null, { status: 404 }); // unknown product id
  }
  return new Response(null, { status: 204 });
}
