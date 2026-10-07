"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useCallback, useTransition, type ReactNode } from "react";

type Update = (changes: Record<string, string | null>) => void;
const Ctx = createContext<{ update: Update; pending: boolean } | null>(null);

/**
 * Filters live in the URL so results are shareable and the back button works.
 * Changes swap the URL in a transition: no full reload, and the grid dims
 * while the server renders the new results.
 */
export function SearchStateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback<Update>(
    (changes) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      // Any filter change goes back to page 1, unless the change *is* the page.
      if (!("page" in changes)) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  return <Ctx value={{ update, pending }}>{children}</Ctx>;
}

export function useSearchState() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useSearchState must be used inside SearchStateProvider");
  return ctx;
}

/** Wraps the results grid; dims it while new results are loading. */
export function PendingRegion({ children }: { children: ReactNode }) {
  const { pending } = useSearchState();
  return (
    <div aria-busy={pending} className="transition-opacity duration-200 data-[pending=true]:opacity-50" data-pending={pending}>
      {children}
    </div>
  );
}
