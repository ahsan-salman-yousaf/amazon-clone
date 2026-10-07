"use client";

import Link from "next/link";
import { ArrowRightIcon, ChevronRightIcon, DumbbellIcon, ShirtIcon, ShoppingBasketIcon, SofaIcon, SmartphoneIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DepartmentGroup } from "@/lib/departments";

const GROUP_ICONS: Record<string, LucideIcon> = {
  Electronics: SmartphoneIcon,
  "Home & Kitchen": SofaIcon,
  Beauty: SparklesIcon,
  Fashion: ShirtIcon,
  "Sports & Outdoors": DumbbellIcon,
  Groceries: ShoppingBasketIcon,
};

/**
 * Floating glass panel (owner decision): inset from every edge, rounded, and
 * options light up coral on hover/focus. Items fade in with a short stagger.
 */
export function DepartmentDrawer({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentGroup[];
}) {
  let i = 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        overlayClassName="bg-black/30"
        className="gap-0 overflow-hidden border-0 bg-white/90 shadow-[0_40px_100px_-24px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.06)] backdrop-blur-2xl data-[side=left]:inset-y-4 data-[side=left]:left-4 data-[side=left]:h-auto data-[side=left]:w-[min(340px,calc(100vw-2rem))] data-[side=left]:rounded-[28px] data-[side=left]:border-r-0 data-[side=left]:sm:inset-y-5 data-[side=left]:sm:left-5 data-[side=left]:sm:max-w-none"
      >
        <SheetHeader className="border-b border-border px-5 pt-5 pb-4">
          <SheetTitle className="text-lg tracking-tight">Shop by department</SheetTitle>
          <SheetDescription className="text-xs">22 departments, grouped</SheetDescription>
        </SheetHeader>
        {/* The list fades out at both ends instead of being cut by the card's edge. */}
        <nav
          aria-label="Departments"
          className="flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-6 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-28px),transparent)]"
        >
          {departments.map((group) => {
            const Icon = GROUP_ICONS[group.name] ?? SparklesIcon;
            return (
              <section key={group.name} className="py-2">
                <h2 className="mb-1 flex items-center gap-2 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <Icon aria-hidden className="size-3.5" />
                  {group.name}
                </h2>
                <ul>
                  {group.categories.map((c) => {
                    const delay = Math.min(i++ * 18, 260);
                    return (
                      <li key={c.slug} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:fill-mode-both motion-safe:duration-300" style={{ animationDelay: `${delay}ms` }}>
                        <Link
                          href={`/c/${c.slug}`}
                          onClick={() => onOpenChange(false)}
                          className="group flex items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-smooth hover:translate-x-0.5 hover:bg-brand hover:text-brand-foreground focus-visible:bg-brand focus-visible:text-brand-foreground focus-visible:outline-none"
                        >
                          {c.name}
                          <ChevronRightIcon aria-hidden className="size-4 -translate-x-1 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            href="/search"
            onClick={() => onOpenChange(false)}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand hover:text-brand-foreground focus-visible:bg-brand focus-visible:text-brand-foreground focus-visible:outline-none"
          >
            Browse all products <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
          <p className="mt-2 flex justify-center gap-1 text-xs">
            {[
              ["About us", "/about"],
              ["Contact us", "/contact"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => onOpenChange(false)}
                className="rounded-full px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground focus-visible:bg-brand focus-visible:text-brand-foreground focus-visible:outline-none"
              >
                {label}
              </Link>
            ))}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
