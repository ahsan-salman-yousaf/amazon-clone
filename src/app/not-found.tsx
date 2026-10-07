import Link from "next/link";
import { SearchForm } from "@/components/search-form";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pt-20 pb-24 text-center">
      <p className="text-sm font-semibold tracking-wider text-star uppercase">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted-foreground">The link may be old, or the product may no longer be sold. Try a search instead.</p>
      <div className="mt-8 w-full">
        <SearchForm id="notfound-search" />
      </div>
      <Link href="/" className="mt-6 text-sm font-medium underline-offset-2 hover:underline">
        Back to the home page
      </Link>
    </main>
  );
}
