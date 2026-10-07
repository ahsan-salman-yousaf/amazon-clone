"use client";

import Image from "next/image";
import { startTransition, useActionState, useId, useState } from "react";
import { CreditCardIcon, LoaderCircleIcon, LockIcon } from "lucide-react";
import { placeOrderAction, type CheckoutState } from "@/app/checkout/actions";
import { DeliveryDate } from "@/components/delivery-date";
import { US_STATES } from "@/lib/address";
import { EXPRESS_TRANSIT_DAYS, STANDARD_TRANSIT_DAYS } from "@/lib/delivery";
import { formatMoney } from "@/lib/format";
import { EXPRESS_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS, TAX_RATE, orderTotals, shippingCents, type ShippingSpeed } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
const inputClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-xl border bg-white/90 px-3.5 text-base transition-shadow focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none sm:text-sm",
    error ? "border-sale" : "border-input",
  );

export type CheckoutLine = { productId: number; title: string; thumbnail: string; priceCents: number; quantity: number };
export type SavedAddress = {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
} | null;

function Field({
  label,
  name,
  error,
  className,
  optional,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; optional?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </label>
      <input id={id} name={name} required={!optional} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className={inputClass(error)} {...props} />
      {error && (
        <p id={`${id}-e`} className="text-xs font-medium text-sale">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${step}`} className="glass rounded-3xl p-5 sm:p-6">
      <h2 id={`step-${step}`} className="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">
          {step}
        </span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function CheckoutForm({
  lines,
  subtotalCents,
  dispatch,
  address,
  idempotencyKey,
}: {
  lines: CheckoutLine[];
  subtotalCents: number;
  dispatch: { min: number; max: number };
  address: SavedAddress;
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [speed, setSpeed] = useState<ShippingSpeed>("standard");
  const totals = orderTotals(subtotalCents, speed);
  const fe = state?.fieldErrors ?? {};
  const standardCost = shippingCents(subtotalCents, "standard");

  const speeds: { value: ShippingSpeed; label: string; transit: number; cost: string }[] = [
    { value: "standard", label: "Standard", transit: STANDARD_TRANSIT_DAYS, cost: standardCost === 0 ? "Free" : formatMoney(standardCost) },
    { value: "expedited", label: "Express", transit: EXPRESS_TRANSIT_DAYS, cost: formatMoney(EXPRESS_SHIPPING_CENTS) },
  ];

  return (
    <form
      // Submit manually: a plain form action resets the fields, which would
      // wipe what the shopper typed when a card is declined.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="mt-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-10"
      noValidate
    >
      <input type="hidden" name="idempotencyKey" value={state?.idempotencyKey ?? idempotencyKey} />
      <div className="flex flex-col gap-6">
        <Section step={1} title="Shipping address">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field className="sm:col-span-6" label="Full name" name="fullName" autoComplete="shipping name" defaultValue={address?.fullName} error={fe.fullName} />
            <Field className="sm:col-span-6" label="Street address" name="line1" autoComplete="shipping address-line1" defaultValue={address?.line1} error={fe.line1} />
            <Field className="sm:col-span-6" label="Apartment, suite, etc." name="line2" optional autoComplete="shipping address-line2" defaultValue={address?.line2 ?? ""} />
            <Field className="sm:col-span-3" label="City" name="city" autoComplete="shipping address-level2" defaultValue={address?.city} error={fe.city} />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="state" className="text-sm font-medium">
                State
              </label>
              <select id="state" name="state" required autoComplete="shipping address-level1" defaultValue={address?.state ?? ""} aria-invalid={!!fe.state} className={inputClass(fe.state)}>
                <option value="" disabled>
                  Choose
                </option>
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              {fe.state && <p className="text-xs font-medium text-sale">{fe.state}</p>}
            </div>
            <Field className="sm:col-span-1" label="ZIP" name="postalCode" inputMode="numeric" autoComplete="shipping postal-code" defaultValue={address?.postalCode} error={fe.postalCode} />
            <Field className="sm:col-span-6" label="Phone" name="phone" optional type="tel" autoComplete="shipping tel" defaultValue={address?.phone ?? ""} error={fe.phone} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">United States only. We&apos;ll save this address for next time.</p>
        </Section>

        <Section step={2} title="Delivery">
          <fieldset>
            <legend className="sr-only">Delivery speed</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {speeds.map((s) => (
                <label
                  key={s.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/70 p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
                    speed === s.value ? "border-primary bg-white" : "border-input hover:bg-white",
                  )}
                >
                  <input type="radio" name="speed" value={s.value} checked={speed === s.value} onChange={() => setSpeed(s.value)} className="mt-1 size-4 accent-primary focus-visible:outline-none" />
                  <span className="flex-1">
                    <span className="flex justify-between gap-2 text-sm font-semibold">
                      {s.label} <span>{s.cost}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      <DeliveryDate dispatchDaysMin={dispatch.min} dispatchDaysMax={dispatch.max} transitDays={s.transit} format="long" />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {standardCost > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Standard delivery is free on orders over {formatMoney(FREE_SHIPPING_THRESHOLD_CENTS)}.</p>
          )}
        </Section>

        <Section step={3} title="Payment">
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-dashed border-input bg-white/60 p-3.5 text-sm">
            <CreditCardIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              <b>Simulated payment: no real money moves.</b> Use test card <span className="font-mono">4242 4242 4242 4242</span> with any future
              date and any 3 digits. <span className="font-mono">4000 0000 0000 0002</span> shows a decline. Real card numbers are refused.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-6">
            <Field className="sm:col-span-6" label="Card number" name="cardNumber" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" error={fe.card} />
            <Field className="sm:col-span-3" label="Expiry (MM/YY)" name="cardExpiry" inputMode="numeric" autoComplete="off" placeholder="12/29" />
            <Field className="sm:col-span-3" label="Security code" name="cardCvc" inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} />
            <Field className="sm:col-span-6" label="Name on card" name="cardName" autoComplete="off" defaultValue={address?.fullName} />
          </div>
        </Section>
      </div>

      <aside aria-label="Order summary" className="mt-6 lg:sticky lg:top-24 lg:mt-0">
        <div className="glass flex flex-col gap-4 rounded-3xl p-5">
          <h2 className="font-semibold tracking-tight">Order summary</h2>
          <ul className="flex flex-col gap-3">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 text-sm">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white/80">
                  <Image src={l.thumbnail} alt="" fill sizes="48px" className="object-contain p-1" />
                  <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{l.quantity}</span>
                </span>
                <span className="line-clamp-2 flex-1">{l.title}</span>
                <span className="tabular-nums">{formatMoney(l.priceCents * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Items</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd className="tabular-nums">{totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Estimated tax ({Math.round(TAX_RATE * 100)}%)</dt>
              <dd className="tabular-nums">{formatMoney(totals.taxCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Order total</dt>
              <dd className="tabular-nums" aria-live="polite">
                {formatMoney(totals.totalCents)}
              </dd>
            </div>
          </dl>
          {state?.error && (
            <p role="alert" className="rounded-xl bg-sale/10 p-3 text-sm font-medium text-sale">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60 ${ring}`}
          >
            {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <LockIcon aria-hidden className="size-4" />}
            {pending ? "Placing your order…" : `Place your order · ${formatMoney(totals.totalCents)}`}
          </button>
          <p className="text-center text-xs text-muted-foreground">Prices and stock are checked again when you place the order.</p>
        </div>
      </aside>
    </form>
  );
}
