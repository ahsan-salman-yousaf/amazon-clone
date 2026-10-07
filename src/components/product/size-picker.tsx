"use client";

import { RulerIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SizeOption } from "@/lib/catalog";
import { SIZE_GUIDES, SIZE_LABEL, type SizeType } from "@/lib/sizes";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

/** Size chips: sold-out sizes are crossed out; the chosen one is ink-filled. */
export function SizePicker({
  sizeType,
  sizes,
  value,
  onChange,
  error,
  compact = false,
}: {
  sizeType: SizeType;
  sizes: SizeOption[];
  value: number | null;
  onChange: (id: number) => void;
  error?: string | null;
  compact?: boolean;
}) {
  const label = SIZE_LABEL[sizeType];
  const chosen = sizes.find((s) => s.id === value);
  return (
    <fieldset id="size-picker" aria-describedby={error ? "size-error" : undefined} className="flex scroll-mt-28 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm">
          <span className="text-muted-foreground">{label}:</span> <span className="font-semibold">{chosen?.label ?? "Choose one"}</span>
        </legend>
        {!compact && <SizeGuide sizeType={sizeType} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => {
          const out = s.stock <= 0;
          const on = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              data-size
              aria-pressed={on}
              aria-label={out ? `${s.label}, sold out` : s.label}
              disabled={out}
              onClick={() => onChange(s.id)}
              className={cn(
                "h-10 min-w-12 rounded-full border px-3.5 text-sm font-medium tabular-nums transition-[background-color,border-color,color] duration-150",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-white/80 hover:border-brand hover:bg-brand/10",
                out && "cursor-not-allowed border-dashed text-muted-foreground line-through opacity-60 hover:border-input hover:bg-white/80",
                error && !on && !out && "border-sale/60",
                ring,
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p id="size-error" role="alert" className="text-sm font-medium text-sale">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function SizeGuide({ sizeType }: { sizeType: SizeType }) {
  const g = SIZE_GUIDES[sizeType];
  return (
    <Sheet>
      <SheetTrigger className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium underline-offset-2 hover:text-brand hover:underline ${ring}`}>
        <RulerIcon aria-hidden className="size-3.5" />
        Size guide
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pt-6">
          <SheetTitle className="text-lg font-semibold tracking-tight">{g.title}</SheetTitle>
          <SheetDescription>{g.note}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <table className="w-full overflow-hidden rounded-2xl text-sm">
            <thead className="bg-muted text-left">
              <tr>
                {g.head.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {g.rows.map((r) => (
                <tr key={r[0]} className="even:bg-muted/40">
                  {r.map((c, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="px-3 py-2 text-left font-medium">
                        {c}
                      </th>
                    ) : (
                      <td key={i} className="px-3 py-2 tabular-nums text-foreground/85">
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
