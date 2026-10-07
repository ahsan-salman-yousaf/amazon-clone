"use client";

import { useSyncExternalStore } from "react";
import { StarIcon } from "lucide-react";
import { useSearchState } from "@/components/search/search-state";
import { estimateArrival, formatArrival, STANDARD_TRANSIT_DAYS } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export type FilterValues = {
  brands: string[];
  price?: string;
  minRating?: number;
  fast: boolean;
  inStock: boolean;
  category?: string;
};
export type Facets = {
  brands: { name: string; count: number }[];
  departments: { slug: string; name: string; count: number }[];
};
export type PriceBand = readonly [value: string, label: string];

const subscribe = () => () => {};

function FastLabel({ fastDays }: { fastDays: number }) {
  const date = useSyncExternalStore(
    subscribe,
    () => formatArrival(estimateArrival(fastDays)),
    () => null,
  );
  return <>{date ? `Arrives by ${date}` : `Arrives in ${fastDays + STANDARD_TRANSIT_DAYS} business days or less`}</>;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={cn("size-3.5 fill-current", i <= n ? "text-star" : "text-star/25")} />
      ))}
    </span>
  );
}

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-4 first:border-0 first:pt-0">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{legend}</legend>
        <div className="flex flex-col">{children}</div>
      </fieldset>
    </div>
  );
}

function Option({
  type,
  name,
  checked,
  onChange,
  children,
  count,
}: {
  type: "checkbox" | "radio";
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm transition-colors hover:bg-black/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/40">
      <input type={type} name={name} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-primary focus-visible:outline-none" />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
    </label>
  );
}

/** The full filter list; used in the desktop sidebar and the mobile sheet. */
export function FilterGroups({
  values,
  facets,
  priceBands,
  fastDays,
  showDepartments,
}: {
  values: FilterValues;
  facets: Facets;
  priceBands: readonly PriceBand[];
  fastDays: number;
  showDepartments: boolean;
}) {
  const { update } = useSearchState();
  const toggleBrand = (b: string) => {
    const set = new Set(values.brands);
    if (set.has(b)) set.delete(b);
    else set.add(b);
    update({ brand: [...set].join(",") || null });
  };

  return (
    <div>
      <Group legend="Delivery">
        <Option type="checkbox" name="fast" checked={values.fast} onChange={() => update({ fast: values.fast ? null : "1" })}>
          <FastLabel fastDays={fastDays} />
        </Option>
        <Option type="checkbox" name="stock" checked={values.inStock} onChange={() => update({ stock: values.inStock ? null : "1" })}>
          In stock only
        </Option>
      </Group>

      {showDepartments && facets.departments.length > 0 && (
        <Group legend="Department">
          <Option type="radio" name="cat" checked={!values.category} onChange={() => update({ cat: null })}>
            All departments
          </Option>
          {facets.departments.map((d) => (
            <Option key={d.slug} type="radio" name="cat" checked={values.category === d.slug} onChange={() => update({ cat: d.slug })} count={d.count}>
              {d.name}
            </Option>
          ))}
        </Group>
      )}

      <Group legend="Customer rating">
        {[4, 3].map((r) => (
          <Option key={r} type="radio" name="rating" checked={values.minRating === r} onChange={() => update({ rating: String(r) })}>
            <Stars n={r} />
            <span className="sr-only">{r} stars</span>
            <span className="text-muted-foreground">&amp; up</span>
          </Option>
        ))}
        <Option type="radio" name="rating" checked={!values.minRating} onChange={() => update({ rating: null })}>
          Any rating
        </Option>
      </Group>

      <Group legend="Price">
        <Option type="radio" name="price" checked={!values.price} onChange={() => update({ price: null })}>
          Any price
        </Option>
        {priceBands.map(([v, label]) => (
          <Option key={v} type="radio" name="price" checked={values.price === v} onChange={() => update({ price: v })}>
            {label}
          </Option>
        ))}
      </Group>

      {facets.brands.length > 0 && (
        <Group legend="Brand">
          {facets.brands.map((b) => (
            <Option key={b.name} type="checkbox" name="brand" checked={values.brands.includes(b.name)} onChange={() => toggleBrand(b.name)} count={b.count}>
              <span className="truncate">{b.name}</span>
            </Option>
          ))}
        </Group>
      )}
    </div>
  );
}
