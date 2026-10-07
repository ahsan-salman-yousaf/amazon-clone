import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SearchResults, SearchResultsSkeleton } from "@/components/search/search-results";
import { getCategories } from "@/lib/catalog";

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

async function getCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  return { title: category?.name ?? "Department" };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[slug]">) {
  const category = await getCategory((await params).slug);
  if (!category) notFound();
  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchResults searchParams={searchParams} category={{ slug: category.slug, name: category.name }} />
      </Suspense>
    </main>
  );
}
