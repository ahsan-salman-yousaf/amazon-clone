"use client";

import { MenuIcon } from "lucide-react";
import { OPEN_DEPARTMENTS_EVENT } from "@/lib/ui-ids";

/** Opens the header's "All" drawer from anywhere on the page. */
export function BrowseDepartmentsButton() {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new Event(OPEN_DEPARTMENTS_EVENT))}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-input bg-white/70 px-6 text-sm font-medium transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <MenuIcon aria-hidden className="size-4" />
      Browse all departments
    </button>
  );
}
