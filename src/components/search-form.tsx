import Form from "next/form";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** GET /search?q=… with client-side navigation; works without JavaScript too. */
export function SearchForm({
  size = "sm",
  defaultValue,
  id,
  className,
}: {
  size?: "sm" | "lg";
  defaultValue?: string;
  id?: string;
  className?: string;
}) {
  const lg = size === "lg";
  return (
    <Form
      action="/search"
      role="search"
      id={id}
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-input bg-white/90 transition-shadow focus-within:ring-3 focus-within:ring-ring/25",
        lg ? "h-14 pr-1.5 pl-5 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)]" : "h-10 pr-1 pl-4",
        className,
      )}
    >
      <SearchIcon aria-hidden className={cn("shrink-0 text-muted-foreground", lg ? "size-5" : "size-4")} />
      <label htmlFor={id ? `${id}-q` : undefined} className="sr-only">
        Search Olympus Cart
      </label>
      <input
        id={id ? `${id}-q` : undefined}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={lg ? "Search products" : "Search Olympus Cart"}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden",
          lg ? "text-base" : "text-sm",
        )}
      />
      <button
        type="submit"
        className={cn(
          "shrink-0 rounded-full bg-brand font-medium text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
          lg ? "h-11 px-6" : "h-8 px-4 text-sm",
        )}
      >
        Search
      </button>
    </Form>
  );
}
