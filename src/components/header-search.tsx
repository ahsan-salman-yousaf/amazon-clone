"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SearchForm } from "@/components/search-form";

/** Header search that keeps the current query visible on results pages. */
export function HeaderSearch() {
  const pathname = usePathname();
  const q = useSearchParams().get("q") ?? "";
  // key: remount so the uncontrolled input picks up a new query after navigation.
  const value = pathname === "/search" ? q : "";
  return <SearchForm id="header-search" key={value} defaultValue={value} />;
}
