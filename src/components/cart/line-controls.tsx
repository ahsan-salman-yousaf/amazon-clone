"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ChevronDownIcon, LoaderCircleIcon, Undo2Icon, XIcon } from "lucide-react";
import { moveToCart, removeFromCart, restoreLine, saveForLater, updateQuantity } from "@/app/cart/actions";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
// Small pills that turn coral (with ink text, AA contrast) on hover and keyboard focus.
const linkButton = `inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-foreground/75 transition-[background-color,color] duration-150 hover:bg-brand hover:text-brand-foreground focus-visible:bg-brand focus-visible:text-brand-foreground focus-visible:outline-none disabled:opacity-50`;

/* ---------------- undo notice, one per cart page ---------------- */

type Notice = { id: number; message: string; undo?: () => Promise<void> };
const NoticeCtx = createContext<(n: Omit<Notice, "id">) => void>(() => {});

export function CartNotices({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [undoing, startUndo] = useTransition();
  const seq = useRef(0);
  const router = useRouter();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice((n) => (n?.id === notice.id ? null : n)), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <NoticeCtx value={(n) => setNotice({ ...n, id: ++seq.current })}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        {notice && (
          <div
            key={notice.id}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-primary py-2 pr-2 pl-5 text-sm text-primary-foreground shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300"
          >
            <span className="max-w-[60vw] truncate">{notice.message}</span>
            {notice.undo && (
              <button
                type="button"
                disabled={undoing}
                onClick={() =>
                  startUndo(async () => {
                    await notice.undo!();
                    router.refresh();
                    setNotice(null);
                  })
                }
                className={`inline-flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 font-semibold transition-colors hover:bg-white/25 ${ring}`}
              >
                {undoing ? <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" /> : <Undo2Icon aria-hidden className="size-3.5" />}
                Undo
              </button>
            )}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className={`grid size-8 place-items-center rounded-full transition-colors hover:bg-white/15 ${ring}`}>
              <XIcon aria-hidden className="size-4" />
            </button>
          </div>
        )}
      </div>
    </NoticeCtx>
  );
}

/* ---------------- one cart line ---------------- */

type LineApi = { run: (fn: () => Promise<void>) => void; setHidden: (h: boolean) => void };
const PendingCtx = createContext<LineApi>({ run: () => {}, setHidden: () => {} });

/** The line dims and shows a spinner while any of its edits is being saved. */
export function CartLineShell({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  // Actions called directly (not via a form) don't re-render the page on their own;
  // refreshing inside the same transition keeps the line dimmed until the new cart arrives.
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <PendingCtx value={{ run, setHidden }}>
      {/* Removed lines disappear at once (the server catches up); Undo brings them back. */}
      <li
        aria-busy={pending}
        hidden={hidden}
        className={cn("relative flex gap-4 py-5 transition-opacity duration-200", pending && !hidden && "opacity-55")}
      >
        {children}
        {pending && (
          <span className="absolute top-5 right-0 text-muted-foreground" role="status">
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
            <span className="sr-only">Updating your cart…</span>
          </span>
        )}
      </li>
    </PendingCtx>
  );
}

const form = (lineId: number, extra: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set("lineId", String(lineId));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
};

export function LineControls({
  lineId,
  productId,
  variantId,
  title,
  quantity,
  max,
  saved,
  canBuy,
}: {
  lineId: number;
  productId: number;
  variantId: number | null;
  title: string;
  quantity: number;
  max: number;
  saved: boolean;
  canBuy: boolean;
}) {
  const { run, setHidden } = use(PendingCtx);
  const notify = use(NoticeCtx);
  const options = Array.from({ length: Math.max(max, quantity, 1) }, (_, i) => i + 1);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {!saved && canBuy && (
        <>
          <label className="sr-only" htmlFor={`qty-${lineId}`}>
            Quantity for {title}
          </label>
          <select
            id={`qty-${lineId}`}
            defaultValue={quantity}
            key={quantity}
            onChange={(e) => {
              const q = e.target.value;
              run(() => updateQuantity(form(lineId, { quantity: q })));
            }}
            // Own chevron + sized to the chosen value: the native arrow sits after the widest option ("Qty 10").
            className={`h-9 appearance-none rounded-full border border-input bg-white pr-8 pl-3.5 text-sm text-foreground transition-colors [field-sizing:content] hover:border-foreground/30 ${ring}`}
          >
            {options.map((n) => (
              <option key={n} value={n}>
                Qty {n}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden className="pointer-events-none -ml-7 mr-3 size-3.5 text-muted-foreground" />
        </>
      )}
      <button
        type="button"
        className={linkButton}
        onClick={() => {
          setHidden(true);
          const removing = removeFromCart(form(lineId));
          // Undo waits for the removal to land, so a quick Undo can't double or lose the line.
          notify({
            message: `Removed ${title}`,
            undo: async () => {
              await removing;
              await restoreLine(productId, variantId, quantity, saved);
              setHidden(false); // still mounted if Undo beat the refresh
            },
          });
          run(() => removing);
        }}
      >
        Remove<span className="sr-only"> {title}</span>
      </button>
      <button
        type="button"
        className={linkButton}
        onClick={() =>
          run(async () => {
            await (saved ? moveToCart : saveForLater)(form(lineId));
            notify({ message: saved ? `Moved ${title} to your cart` : `Saved ${title} for later` });
          })
        }
      >
        {saved ? "Move to cart" : "Save for later"}
        <span className="sr-only"> {title}</span>
      </button>
    </div>
  );
}
