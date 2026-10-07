"use client";

import { useEffect } from "react";

/** Fire-and-forget view beacon for "Customers also viewed". */
export function ViewTracker({ productId }: { productId: number }) {
  useEffect(() => {
    const body = JSON.stringify({ productId });
    if (!navigator.sendBeacon?.("/api/views", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/views", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    }
  }, [productId]);
  return null;
}
