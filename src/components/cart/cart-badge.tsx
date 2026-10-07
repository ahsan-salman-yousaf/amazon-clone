import { cartCount, readCartId } from "@/lib/cart";

/** Item count bubble on the header cart icon; streams in per request. */
export async function CartBadge() {
  const id = await readCartId();
  const n = id ? await cartCount(id) : 0;
  if (!n) return <span className="sr-only">, empty</span>;
  return (
    <>
      <span aria-hidden className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground tabular-nums">
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only">
        , {n} item{n === 1 ? "" : "s"}
      </span>
    </>
  );
}
