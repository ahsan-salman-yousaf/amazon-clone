"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, SearchIcon, ShoppingCartIcon, UserIcon } from "lucide-react";
import { DepartmentDrawer } from "@/components/department-drawer";
import { SearchForm } from "@/components/search-form";
import type { DepartmentGroup } from "@/lib/departments";
import { HERO_SEARCH_ID, OPEN_DEPARTMENTS_EVENT } from "@/lib/ui-ids";
import { cn } from "@/lib/utils";

/**
 * Only one search box is ever on screen (owner decision). On home the hero
 * search is primary and the header search fades in once it scrolls away;
 * every other page shows the header search all the time.
 */
function useHeaderSearchVisible() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [heroHidden, setHeroHidden] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const hero = document.getElementById(HERO_SEARCH_ID);
    if (!hero) return;
    const io = new IntersectionObserver(([entry]) => setHeroHidden(!entry.isIntersecting), {
      rootMargin: "-80px 0px 0px 0px",
    });
    io.observe(hero);
    return () => io.disconnect();
  }, [isHome]);

  return !isHome || heroHidden;
}

export function SiteHeader({ departments }: { departments: DepartmentGroup[] }) {
  const showSearch = useHeaderSearchVisible();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const open = () => setDrawerOpen(true);
    window.addEventListener(OPEN_DEPARTMENTS_EVENT, open);
    return () => window.removeEventListener(OPEN_DEPARTMENTS_EVENT, open);
  }, []);

  const jumpToHero = () => {
    const form = document.getElementById(HERO_SEARCH_ID);
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
    form?.querySelector("input")?.focus({ preventScroll: true });
  };

  const reveal = cn(
    "transition-[opacity,translate] duration-250 ease-smooth",
    showSearch ? "opacity-100" : "pointer-events-none -translate-y-1.5 opacity-0",
  );

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass mx-auto flex h-14 max-w-7xl items-center gap-2 rounded-2xl px-2 md:px-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <MenuIcon aria-hidden className="size-4" />
          <span>All</span>
        </button>

        <Link
          href="/"
          className="rounded-lg px-1 text-lg font-bold tracking-tight whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Olympus<span className="text-star">Cart</span>
        </Link>

        <div className={cn("mx-auto hidden w-full max-w-xl md:block", reveal)} inert={!showSearch}>
          <SearchForm id="header-search" />
        </div>

        <nav aria-label="Account" className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            onClick={jumpToHero}
            aria-label="Search"
            inert={!showSearch}
            className={cn(
              "grid size-10 place-items-center rounded-xl hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none md:hidden",
              reveal,
            )}
          >
            <SearchIcon aria-hidden className="size-5" />
          </button>
          <Link
            href="/signin"
            className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <UserIcon aria-hidden className="size-4" />
            <span className="hidden sm:inline">Sign in</span>
            <span className="sr-only sm:hidden">Sign in</span>
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="grid size-10 place-items-center rounded-xl transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ShoppingCartIcon aria-hidden className="size-5" />
          </Link>
        </nav>
      </div>

      <DepartmentDrawer open={drawerOpen} onOpenChange={setDrawerOpen} departments={departments} />
    </header>
  );
}
