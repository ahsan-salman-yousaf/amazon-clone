"use client";

import Link from "next/link";
import { RotateCwIcon } from "lucide-react";

/** Route-level error boundary: says what happened and offers a next step. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pt-20 pb-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">This page didn&apos;t load</h1>
      <p className="mt-2 text-muted-foreground">
        Something on our side failed while loading it. Your cart and any orders are safe. Try again, or go back to the home page.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <RotateCwIcon aria-hidden className="size-4" /> Try again
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-input bg-white/70 px-6 text-sm font-medium transition-colors hover:bg-white">
          Home page
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
    </main>
  );
}
