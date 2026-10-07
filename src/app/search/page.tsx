import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults, SearchResultsSkeleton } from "@/components/search/search-results";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
