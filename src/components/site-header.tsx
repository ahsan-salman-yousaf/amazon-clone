"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { MapPinIcon, MenuIcon, SearchIcon, ShoppingCartIcon } from "lucide-react";
import { DepartmentDrawer } from "@/components/department-drawer";
import { HeaderSearch } from "@/components/header-search";
import { SearchForm } from "@/components/search-form";
import type { DepartmentGroup } from "@/lib/departments";
import { HERO_SEARCH_ID, OPEN_DEPARTMENTS_EVENT } from "@/lib/ui-ids";
import { cn } from "@/lib/utils";

/**
 * Only one search box is ever on screen (owner decision). On home the hero
 * search is primary and the header search fades in once it scrolls away;
 * every other page shows the header search all the time.
 */
function useHeaderSearchVisible(isHome: boolean) {
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

type HeaderProps = {
  departments: DepartmentGroup[];
  cartBadge?: ReactNode;
  account: ReactNode;
};

/**
 * The pathname is request data on routes whose params aren't known at build
 * time, so it is read inside Suspense. The fallback is the regular (non-home)
 * header, which is what those routes show anyway.
 */
export function SiteHeader(props: HeaderProps) {
  return (
    <Suspense fallback={<HeaderBar {...props} isHome={false} />}>
      <PathAwareHeader {...props} />
    </Suspense>
  );
}

function PathAwareHeader(props: HeaderProps) {
  return <HeaderBar {...props} isHome={usePathname() === "/"} />;
}

function HeaderBar({ departments, cartBadge, account, isHome }: HeaderProps & { isHome: boolean }) {
  const showSearch = useHeaderSearchVisible(isHome);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const open = () => setDrawerOpen(true);
    window.addEventListener(OPEN_DEPARTMENTS_EVENT, open);
    return () => window.removeEventListener(OPEN_DEPARTMENTS_EVENT, open);
  }, []);

  const router = useRouter();
  // Mobile has no room for a header search box: on home the icon jumps to the
  // hero search; elsewhere it opens the search page, which has its own box.
  const openSearch = () => {
    const form = document.getElementById(HERO_SEARCH_ID);
    if (!form) return router.push("/search?focus=1");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    form.querySelector("input")?.focus({ preventScroll: true });
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
          aria-label="All departments"
          className="grid size-10 place-items-center rounded-xl transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <MenuIcon aria-hidden className="size-5" />
        </button>

        <Link
          href="/"
          className="rounded-lg px-1 text-lg font-bold tracking-tight whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Olympus<span className="text-star">Cart</span>
        </Link>

        {/* We only ship within the US for now (owner decision). */}
        <p className="hidden shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs leading-tight lg:flex">
          <MapPinIcon aria-hidden className="size-4 text-muted-foreground" />
          <span>
            <span className="block text-muted-foreground">Delivering to</span>
            <span className="font-semibold">USA</span>
          </span>
        </p>

        <div className={cn("mx-auto hidden w-full max-w-xl md:block", reveal)} inert={!showSearch}>
          <Suspense fallback={<SearchForm id="header-search" />}>
            <HeaderSearch />
          </Suspense>
        </div>

        <nav aria-label="Account" className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            inert={!showSearch}
            className={cn(
              "grid size-10 place-items-center rounded-xl hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none md:hidden",
              reveal,
            )}
          >
            <SearchIcon aria-hidden className="size-5" />
          </button>
          {account}
          <Link
            href="/cart"
            className="relative grid size-10 place-items-center rounded-xl transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ShoppingCartIcon aria-hidden className="size-5" />
            <span className="sr-only">Cart</span>
            {cartBadge}
          </Link>
        </nav>
      </div>

      <DepartmentDrawer open={drawerOpen} onOpenChange={setDrawerOpen} departments={departments} />
    </header>
  );
}
