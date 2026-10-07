import { cn } from "@/lib/utils";

/** Solid coral bubble for "-12%" (owner decision). Ink on coral passes WCAG AA (5.77:1). */
export function DiscountBadge({ percent, className }: { percent: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[11px] leading-4 font-bold text-brand-foreground tabular-nums shadow-sm", className)}>
      <span aria-hidden>-{percent}%</span>
      <span className="sr-only">{percent}% off</span>
    </span>
  );
}
