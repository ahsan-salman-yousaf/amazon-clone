"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useTransition } from "react";
import { HeartIcon } from "lucide-react";
import { toggleWishlist } from "@/app/wishlist/actions";
import { cn } from "@/lib/utils";

/* One shared store per tab: a single /api/wishlist request serves every heart on the page. */
type State = { loaded: boolean; signedIn: boolean; ids: Set<number> };
let state: State = { loaded: false, signedIn: false, ids: new Set() };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
const emit = () => listeners.forEach((l) => l());
const setState = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};

function load() {
  loading ??= fetch("/api/wishlist", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { signedIn: boolean; ids: number[] }) => setState({ loaded: true, signedIn: d.signedIn, ids: new Set(d.ids) }))
    .catch(() => setState({ loaded: true }))
    .finally(() => (loading = null));
  return loading;
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (!state.loaded) void load();
  return () => listeners.delete(l);
};
/** Rendered by the account menu: reloads hearts whenever the signed-in account changes. */
let syncedUser: string | null | undefined;
export function WishlistSessionSync({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (syncedUser === userId) return;
    const first = syncedUser === undefined;
    syncedUser = userId;
    if (!first || !state.loaded) {
      if (!userId) setState({ loaded: true, signedIn: false, ids: new Set() });
      else void load();
    }
  }, [userId]);
  return null;
}

const SERVER: State = { loaded: false, signedIn: false, ids: new Set() };

export function WishlistButton({ productId, title, variant = "card" }: { productId: number; title: string; variant?: "card" | "page" }) {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  const saved = s.ids.has(productId);
  const [, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    if (s.loaded && !s.signedIn) return router.push(`/signin?next=${encodeURIComponent(pathname)}`);
    const next = !saved;
    // Optimistic: flip now, roll back if the server says no.
    const ids = new Set(state.ids);
    if (next) ids.add(productId);
    else ids.delete(productId);
    setState({ ids });
    start(async () => {
      const r = await toggleWishlist(productId, next);
      if (!r.ok) {
        const back = new Set(state.ids);
        if (next) back.delete(productId);
        else back.add(productId);
        setState({ ids: back });
        if (r.reason === "signin") router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      }
    });
  };

  const label = saved ? `Remove ${title} from your wishlist` : `Save ${title} to your wishlist`;
  if (variant === "page") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={label}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-input bg-white/70 px-5 text-sm font-medium transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <HeartIcon aria-hidden className={cn("size-4 transition-[transform,color,fill] duration-200", saved && "scale-110 fill-brand text-brand")} />
        {saved ? "Saved to wishlist" : "Save to wishlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition-transform duration-200 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-95"
    >
      <HeartIcon aria-hidden className={cn("size-4 transition-[transform,color,fill] duration-200", saved && "scale-110 fill-brand text-brand")} />
    </button>
  );
}
