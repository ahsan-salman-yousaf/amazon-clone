"use client";

import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DepartmentGroup } from "@/lib/departments";

export function DepartmentDrawer({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentGroup[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(340px,88vw)] gap-0 overflow-y-auto bg-white/95 backdrop-blur-xl">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="text-base">All departments</SheetTitle>
          <SheetDescription className="sr-only">Browse products by department</SheetDescription>
        </SheetHeader>
        <nav aria-label="Departments" className="px-5 pb-8">
          {departments.map((group) => (
            <section key={group.name} className="border-t border-border py-3 first:border-0">
              <h2 className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">{group.name}</h2>
              <ul>
                {group.categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/c/${c.slug}`}
                      onClick={() => onOpenChange(false)}
                      className="block rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
