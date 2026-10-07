"use client";

import { useState } from "react";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { FilterGroups, type Facets, type FilterValues, type PriceBand } from "@/components/search/filters";
import { useSearchState } from "@/components/search/search-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export function SortSelect({ sort, sorts }: { sort: string; sorts: Record<string, string> }) {
  const { update } = useSearchState();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">Sort</span>
      <span className="sr-only sm:hidden">Sort by</span>
      <select
        value={sort}
        onChange={(e) => update({ sort: e.target.value === "featured" ? null : e.target.value })}
        className={`h-9 rounded-full border border-input bg-white/80 pr-8 pl-3 text-sm ${ring}`}
      >
        {Object.entries(sorts).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export type Pill = { key: string; label: string; clear: Record<string, string | null> };

export function ActivePills({ pills }: { pills: Pill[] }) {
  const { update } = useSearchState();
  if (!pills.length) return null;
  const clearAll = Object.assign({}, ...pills.map((p) => Object.fromEntries(Object.keys(p.clear).map((k) => [k, null]))));
  return (
    <ul aria-label="Active filters" className="mt-3 flex flex-wrap items-center gap-2">
      {pills.map((p) => (
        <li key={p.key}>
          <button
            type="button"
            onClick={() => update(p.clear)}
            className={`inline-flex h-7 items-center gap-1 rounded-full bg-primary pr-2 pl-3 text-xs font-medium text-primary-foreground ${ring}`}
          >
            {p.label}
            <XIcon aria-hidden className="size-3.5 opacity-70" />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={() => update(clearAll)} className={`h-7 rounded-md px-2 text-xs font-medium underline-offset-2 hover:underline ${ring}`}>
          Clear all
        </button>
      </li>
    </ul>
  );
}

/** Mobile: a Filters button that opens the same filters in a bottom sheet. */
export function MobileFilters({
  values,
  facets,
  priceBands,
  fastDays,
  showDepartments,
  activeCount,
  total,
}: {
  values: FilterValues;
  facets: Facets;
  priceBands: readonly PriceBand[];
  fastDays: number;
  showDepartments: boolean;
  activeCount: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const { pending } = useSearchState();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex h-9 items-center gap-2 rounded-full border border-input bg-white/80 px-4 text-sm font-medium lg:hidden ${ring}`}
      >
        <SlidersHorizontalIcon aria-hidden className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{activeCount}</span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-3xl bg-white">
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription className="sr-only">Narrow down the results</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-5 pb-4">
            <FilterGroups values={values} facets={facets} priceBands={priceBands} fastDays={fastDays} showDepartments={showDepartments} />
          </div>
          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground ${ring}`}
            >
              {pending ? "Updating…" : `Show ${total} result${total === 1 ? "" : "s"}`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
