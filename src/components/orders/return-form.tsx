"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { AlertCircleIcon, LoaderCircleIcon, PackageOpenIcon } from "lucide-react";
import { requestReturnAction, type ReturnFormState } from "@/app/orders/[id]/return/actions";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export type ReturnableItem = {
  itemId: number;
  variantLabel: string | null;
  title: string;
  thumbnail: string;
  unitPriceCents: number;
  remaining: number;
  windowDays: number;
  closesAt: string | null;
  blockedReason: string | null;
};

export function ReturnForm({
  orderId,
  items,
  reasons,
  taxRate,
}: {
  orderId: string;
  items: ReturnableItem[];
  reasons: Record<string, string>;
  taxRate: number;
}) {
  const [state, action, pending] = useActionState<ReturnFormState, FormData>(requestReturnAction, null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");

  const itemsCents = items.reduce((s, it) => s + (picked[it.itemId] ? it.unitPriceCents * picked[it.itemId] : 0), 0);
  const refund = itemsCents + Math.round(itemsCents * taxRate);
  const err = (f: NonNullable<ReturnFormState>["field"]) => (state && state.field === f ? state.error : undefined);

  return (
    <form
      // Submitted manually so an error doesn't clear the note.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="orderId" value={orderId} />

      <fieldset className="glass rounded-3xl p-5" aria-describedby={err("items") ? "items-err" : undefined}>
        <legend className="sr-only">Items to return</legend>
        <h2 className="font-semibold tracking-tight">1. Which items?</h2>
        <ul className="mt-3 divide-y divide-border">
          {items.map((it) => {
            const on = !!picked[it.itemId];
            const disabled = !!it.blockedReason;
            return (
              <li key={it.itemId} className={cn("flex items-center gap-4 py-3", disabled && "opacity-60")}>
                <input
                  type="checkbox"
                  id={`item-${it.itemId}`}
                  name="item"
                  value={it.itemId}
                  disabled={disabled}
                  checked={on}
                  onChange={(e) => setPicked((p) => ({ ...p, [it.itemId]: e.target.checked ? 1 : 0 }))}
                  className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
                />
                <label htmlFor={`item-${it.itemId}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/80">
                    <Image src={it.thumbnail} alt="" fill sizes="56px" className="object-contain p-1.5" />
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="line-clamp-2 font-medium">{it.title}</span>
                    {it.variantLabel && <span className="block text-xs text-muted-foreground">Size: {it.variantLabel}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {it.blockedReason ??
                        `${formatMoney(it.unitPriceCents)} each · return by ${new Date(it.closesAt!).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                    </span>
                  </span>
                </label>
                {on && it.remaining > 1 && (
                  <>
                    <label htmlFor={`qty-${it.itemId}`} className="sr-only">
                      Quantity of {it.title} to return
                    </label>
                    <select
                      id={`qty-${it.itemId}`}
                      name={`qty-${it.itemId}`}
                      value={picked[it.itemId]}
                      onChange={(e) => setPicked((p) => ({ ...p, [it.itemId]: Number(e.target.value) }))}
                      className={`h-9 rounded-full border border-input bg-white pr-8 pl-3 text-sm text-foreground ${ring}`}
                    >
                      {Array.from({ length: it.remaining }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Qty {n}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {on && it.remaining === 1 && <input type="hidden" name={`qty-${it.itemId}`} value={1} />}
              </li>
            );
          })}
        </ul>
        {err("items") && (
          <p id="items-err" className="mt-2 flex items-center gap-1 text-sm font-medium text-sale">
            <AlertCircleIcon aria-hidden className="size-4" /> {err("items")}
          </p>
        )}
      </fieldset>

      <div className="glass flex flex-col gap-4 rounded-3xl p-5">
        <h2 className="font-semibold tracking-tight">2. Why are you returning them?</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            Reason
          </label>
          <select
            id="reason"
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!err("reason")}
            className={cn("h-11 rounded-xl border bg-white px-3.5 text-sm text-foreground", ring, err("reason") ? "border-sale" : "border-input")}
          >
            <option value="" disabled>
              Choose a reason…
            </option>
            {Object.entries(reasons).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {err("reason") && <p className="text-xs font-medium text-sale">{err("reason")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="note" className="text-sm font-medium">
            Anything else? <span className="font-normal text-muted-foreground">{reason === "other" ? "(required)" : "(optional)"}</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            aria-invalid={!!err("note")}
            placeholder="e.g. The box was crushed and the left earbud doesn't charge…"
            className={cn("rounded-xl border bg-white/90 px-3.5 py-2.5 text-sm text-foreground", ring, err("note") ? "border-sale" : "border-input")}
          />
          {err("note") && <p className="text-xs font-medium text-sale">{err("note")}</p>}
        </div>
      </div>

      <div className="glass flex flex-col gap-3 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          Refund{" "}
          <b className="text-base tabular-nums" aria-live="polite">
            {formatMoney(refund)}
          </b>{" "}
          <span className="text-muted-foreground">to your original payment method, items plus tax. Delivery isn&apos;t refunded.</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <Link href={`/orders/${orderId}`} className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium hover:bg-black/5 ${ring}`}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className={`inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60 ${ring}`}
          >
            {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <PackageOpenIcon aria-hidden className="size-4" />}
            {pending ? "Requesting…" : "Request return"}
          </button>
        </div>
      </div>
      {state && !state.field && (
        <p role="alert" className="rounded-2xl bg-sale/[0.06] p-3.5 text-sm font-medium text-sale">
          {state.error}
        </p>
      )}
    </form>
  );
}
