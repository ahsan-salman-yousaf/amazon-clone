"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { AlertCircleIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon, CreditCardIcon, LoaderCircleIcon, LockIcon } from "lucide-react";
import { placeOrderAction } from "@/app/checkout/actions";
import { cancelStripePayment, finalizeStripePayment, startStripePayment } from "@/app/checkout/stripe-actions";
import { DeliveryDate } from "@/components/delivery-date";
import { US_STATES, addressSchema, type AddressField } from "@/lib/address";
import type { CheckoutState } from "@/lib/checkout-errors";
import { EXPRESS_TRANSIT_DAYS, STANDARD_TRANSIT_DAYS } from "@/lib/delivery";
import { formatMoney } from "@/lib/format";
import { describeStripeError } from "@/lib/payments/messages";
import { EXPRESS_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS, TAX_RATE, orderTotals, shippingCents, type ShippingSpeed } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
const inputClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-xl border bg-white/90 px-3.5 text-base transition-[border-color,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none sm:text-sm",
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

type CheckoutProps = {
  lines: CheckoutLine[];
  subtotalCents: number;
  dispatch: { min: number; max: number };
  address: SavedAddress;
  idempotencyKey: string;
  /** Stripe test-mode publishable key; absent means the simulated provider. */
  stripePublishableKey?: string;
};

/** Submits the order and resolves with an error state (success navigates away). */
type Submit = (fd: FormData) => Promise<CheckoutState>;

// Owner decision: a guided three-step checkout, one piece of information per step.
const STEPS = [
  { n: 1, title: "Shipping address", short: "Address" },
  { n: 2, title: "Delivery", short: "Delivery" },
  { n: 3, title: "Payment", short: "Payment" },
] as const;
type Step = 1 | 2 | 3;

const ADDRESS_FIELDS: AddressField[] = ["fullName", "line1", "line2", "city", "state", "postalCode", "phone"];

/* ---------------------------------------------------------------- entry */

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#16181D",
    colorText: "#16181D",
    colorDanger: "#B42318",
    colorBackground: "#FFFFFF",
    borderRadius: "12px",
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
    spacingUnit: "4px",
  },
};

export function CheckoutForm(props: CheckoutProps) {
  const { stripePublishableKey: key } = props;
  // Loaded as soon as checkout renders, so the card fields are ready by step 3.
  const stripePromise = useMemo(() => (key ? loadStripe(key) : null), [key]);
  if (!stripePromise) {
    return <CheckoutSteps {...props} submit={(fd) => placeOrderAction(null, fd)} renderPayment={(err) => <SimulatedCardFields error={err} />} />;
  }
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: orderTotals(props.subtotalCents, "standard").totalCents,
        currency: "usd",
        allowedPaymentMethodTypes: ["card"],
        appearance,
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" }],
      }}
    >
      <StripeCheckout {...props} />
    </Elements>
  );
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/**
 * Stripe test mode: validate the card fields, let the server re-price and
 * reserve the order, confirm with Stripe, then the server verifies with
 * Stripe before marking it paid (the webhook does the same, idempotently).
 */
function StripeCheckout(props: CheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loadError, setLoadError] = useState<string | null>(null);
  const onTotalChange = useCallback(
    (amount: number) => {
      elements?.update({ amount });
    },
    [elements],
  );

  const submit: Submit = async (fd) => {
    if (!stripe || !elements) return { code: "service", error: "The secure card form is still loading. Give it a second and try again." };
    const { error: invalid } = await elements.submit();
    if (invalid) return { code: "card", error: describeStripeError(invalid) };

    const started = await startStripePayment(fd);
    if (!started.ok) return { code: started.code, error: started.error, fieldErrors: started.fieldErrors };

    // Anything unexpected from Stripe.js must not strand reserved stock or crash the page.
    const fail = async (message: string): Promise<CheckoutState> => {
      await cancelStripePayment(started.paymentId, message);
      return { code: "card", error: message, idempotencyKey: crypto.randomUUID() };
    };
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret: started.clientSecret,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/checkout/complete`,
          payment_method_data: {
            billing_details: {
              name: field(fd, "fullName"),
              phone: field(fd, "phone") || undefined,
              address: {
                line1: field(fd, "line1"),
                line2: field(fd, "line2") || undefined,
                city: field(fd, "city"),
                state: field(fd, "state"),
                postal_code: field(fd, "postalCode"),
                country: "US",
              },
            },
          },
        },
      });
      if (error) return fail(describeStripeError(error));
    } catch {
      return fail("The card form stopped responding, so nothing was charged. Reload the page and try again.");
    }
    await finalizeStripePayment(started.paymentId); // redirects to the order
    return null;
  };

  return (
    <CheckoutSteps
      {...props}
      submit={submit}
      onTotalChange={onTotalChange}
      paymentNote={
        <>
          <b>Stripe test mode: no real money moves.</b> Use <span className="font-mono">4242 4242 4242 4242</span>, any future date and any CVC.
          Try <span className="font-mono">4000 0000 0000 9995</span> (insufficient funds) or <span className="font-mono">4000 0000 0000 0069</span>{" "}
          (expired card) to see specific errors.
        </>
      }
      renderPayment={() => (
        <>
          {loadError && (
            <p role="alert" className="mb-3 flex items-start gap-2 rounded-2xl bg-sale/[0.06] p-3.5 text-sm font-medium text-sale">
              <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              {loadError}
            </p>
          )}
        <PaymentElement
          onLoadError={(e) => {
            console.error("Stripe Payment Element failed to load", e.error);
            setLoadError("The secure card form couldn't load. Check your connection or disable any content blocker for js.stripe.com, then reload.");
          }}
          options={{
            layout: "tabs",
            wallets: { link: "never", applePay: "never", googlePay: "never" },
            fields: { billingDetails: { name: "never", phone: "never", address: "never" } },
          }}
        />
        </>
      )}
    />
  );
}

/* --------------------------------------------------------------- pieces */

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-xs font-medium text-sale motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
      <AlertCircleIcon aria-hidden className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

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
      <input
        id={id}
        name={name}
        required={!optional}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-e` : undefined}
        className={inputClass(error)}
        {...props}
      />
      {error && <FieldError id={`${id}-e`}>{error}</FieldError>}
    </div>
  );
}

function SimulatedCardFields({ error }: { error?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field className="sm:col-span-6" label="Card number" name="cardNumber" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" error={error} />
      <Field className="sm:col-span-3" label="Expiry (MM/YY)" name="cardExpiry" inputMode="numeric" autoComplete="off" placeholder="12/29" />
      <Field className="sm:col-span-3" label="Security code" name="cardCvc" inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} />
      <Field className="sm:col-span-6" label="Name on card" name="cardName" autoComplete="off" />
    </div>
  );
}

/** "Step 2 of 3" with numbered steps and a progress line that fills smoothly. */
function Stepper({ step, reached, onGo }: { step: Step; reached: Step; onGo: (s: Step) => void }) {
  const progress = (step - 1) / (STEPS.length - 1);
  return (
    <nav aria-label="Checkout progress" className="glass rounded-3xl px-5 pt-4 pb-5 sm:px-8">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Step <span className="font-semibold text-foreground tabular-nums">{step}</span> of {STEPS.length}
        <span className="text-foreground"> · {STEPS[step - 1].title}</span>
      </p>
      <ol className="relative mt-4 flex items-start justify-between">
        <span aria-hidden className="absolute top-4 right-4 left-4 h-0.5 rounded-full bg-black/10" />
        <span
          aria-hidden
          className="absolute top-4 right-4 left-4 h-0.5 origin-left rounded-full bg-primary transition-transform duration-500 ease-smooth"
          style={{ transform: `scaleX(${progress})` }}
        />
        {STEPS.map(({ n, short }) => {
          const done = n < step;
          const current = n === step;
          const canGo = n <= reached && !current;
          return (
            <li key={n} className="relative z-10 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => canGo && onGo(n)}
                disabled={!canGo}
                aria-current={current ? "step" : undefined}
                aria-label={`${short}${done ? ", completed" : current ? ", current step" : ""}`}
                className={cn(
                  "grid size-8 place-items-center rounded-full text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-300 ease-smooth",
                  ring,
                  done && "bg-primary text-primary-foreground hover:scale-105",
                  current && "bg-brand text-brand-foreground shadow-[0_0_0_6px_color-mix(in_srgb,var(--brand)_22%,transparent)]",
                  !done && !current && "border border-input bg-white text-muted-foreground",
                  canGo ? "cursor-pointer" : "cursor-default",
                )}
              >
                {done ? <CheckIcon aria-hidden className="size-4 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" /> : n}
              </button>
              <span className={cn("text-xs font-medium transition-colors duration-300", current || done ? "text-foreground" : "text-muted-foreground")}>{short}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ErrorBanner({ state }: { state: NonNullable<CheckoutState> }) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-2.5 rounded-2xl border border-sale/25 bg-sale/[0.06] p-3.5 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
    >
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-sale" />
      <div className="flex-1">
        <p className="font-medium text-sale">{state.error}</p>
        {state.code === "stock" && (
          <Link href="/cart" className="mt-1 inline-block font-medium underline underline-offset-2">
            Review your cart
          </Link>
        )}
        {state.code === "cart_empty" && (
          <Link href="/" className="mt-1 inline-block font-medium underline underline-offset-2">
            Continue shopping
          </Link>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- flow */

function CheckoutSteps({
  lines,
  subtotalCents,
  dispatch,
  address,
  idempotencyKey,
  submit,
  renderPayment,
  paymentNote,
  onTotalChange,
}: CheckoutProps & {
  submit: Submit;
  renderPayment: (cardError?: string) => ReactNode;
  paymentNote?: ReactNode;
  onTotalChange?: (totalCents: number) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [step, setStep] = useState<Step>(1);
  const [reached, setReached] = useState<Step>(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [state, setState] = useState<CheckoutState>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AddressField, string>>>({});
  const [key, setKey] = useState(idempotencyKey);
  const [pending, startTransition] = useTransition();
  const [speed, setSpeed] = useState<ShippingSpeed>("standard");
  const [recap, setRecap] = useState<string[]>([]);

  const totals = orderTotals(subtotalCents, speed);
  useEffect(() => {
    // Braces matter: an effect's return value is treated as its cleanup function.
    onTotalChange?.(totals.totalCents);
  }, [totals.totalCents, onTotalChange]);
  const standardCost = shippingCents(subtotalCents, "standard");

  const go = (next: Step) => {
    setDirection(next > step ? "forward" : "back");
    setStep(next);
    setReached((r) => (next > r ? next : r));
    // Payment-side errors stay visible until the next attempt; others clear on navigation.
    setState((s) => (s && (s.code === "card" || s.code === "service" || s.code === "network") ? s : null));
  };

  // Land focus on the new step's heading so keyboard and screen-reader users are in the right place.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    const top = form.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) form.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const focusField = (name: AddressField) => {
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus());
  };

  const continueFromAddress = () => {
    const fd = new FormData(form.current!);
    const parsed = addressSchema.safeParse(Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, String(fd.get(f) ?? "")])));
    if (!parsed.success) {
      const errs: Partial<Record<AddressField, string>> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as AddressField] ??= i.message;
      setFieldErrors(errs);
      focusField(Object.keys(errs)[0] as AddressField);
      return;
    }
    const a = parsed.data;
    setFieldErrors({});
    setRecap([a.fullName, [a.line1, a.line2].filter(Boolean).join(", "), `${a.city}, ${a.state} ${a.postalCode}`]);
    go(2);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Submit manually: a plain form action resets the fields, which would
    // wipe what the shopper typed when a card is declined.
    e.preventDefault();
    if (step === 1) return continueFromAddress();
    if (step === 2) return go(3);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      let result: CheckoutState;
      try {
        result = await submit(fd);
      } catch (err) {
        // Server-action redirects arrive as thrown navigation signals; let them through.
        const digest = err && typeof err === "object" && "digest" in err ? String((err as { digest: unknown }).digest) : "";
        if (digest.startsWith("NEXT_REDIRECT")) throw err;
        result = { code: "network", error: "We couldn't reach our server, so nothing was charged. Check your connection and try again." };
      }
      if (!result) return;
      setState(result);
      if (result.idempotencyKey) setKey(result.idempotencyKey);
      if (result.code === "address") {
        setFieldErrors(result.fieldErrors ?? {});
        setDirection("back");
        setStep(1);
        const first = Object.keys(result.fieldErrors ?? {})[0] as AddressField | undefined;
        if (first) focusField(first);
      }
    });
  };

  const enter = direction === "forward" ? "motion-safe:slide-in-from-right-8" : "motion-safe:slide-in-from-left-8";
  const panelClass = cn("motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-smooth", enter);
  const speeds: { value: ShippingSpeed; label: string; transit: number; cost: string }[] = [
    { value: "standard", label: "Standard", transit: STANDARD_TRANSIT_DAYS, cost: standardCost === 0 ? "Free" : formatMoney(standardCost) },
    { value: "expedited", label: "Express", transit: EXPRESS_TRANSIT_DAYS, cost: formatMoney(EXPRESS_SHIPPING_CENTS) },
  ];
  const chosen = speeds.find((s) => s.value === speed)!;
  const cardError = state?.code === "card" ? state.error : undefined;

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="mt-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-10">
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="speed" value={speed} />

      <div className="flex min-w-0 flex-col gap-5">
        <Stepper step={step} reached={reached} onGo={go} />

        <section aria-labelledby="checkout-step" className="glass overflow-hidden rounded-3xl p-5 sm:p-6">
          <h2 id="checkout-step" ref={heading} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
            {STEPS[step - 1].title}
          </h2>

          <div className="mt-5">
            {state && state.code !== "address" && <ErrorBanner state={state} />}

            {/* Every step stays mounted (the card form is ready early and nothing typed is lost); only the active
                one shows. Un-hiding an element restarts its CSS animation, so each step animates in on arrival. */}
            <div hidden={step !== 1} className={panelClass}>
              <div className="grid gap-4 sm:grid-cols-6">
                <Field className="sm:col-span-6" label="Full name" name="fullName" autoComplete="shipping name" defaultValue={address?.fullName} error={fieldErrors.fullName} />
                <Field className="sm:col-span-6" label="Street address" name="line1" autoComplete="shipping address-line1" defaultValue={address?.line1} error={fieldErrors.line1} />
                <Field className="sm:col-span-6" label="Apartment, suite, etc." name="line2" optional autoComplete="shipping address-line2" defaultValue={address?.line2 ?? ""} />
                <Field className="sm:col-span-2" label="City" name="city" autoComplete="shipping address-level2" defaultValue={address?.city} error={fieldErrors.city} />
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="state" className="text-sm font-medium">
                    State
                  </label>
                  <select
                    id="state"
                    name="state"
                    required
                    autoComplete="shipping address-level1"
                    defaultValue={address?.state ?? ""}
                    aria-invalid={!!fieldErrors.state}
                    aria-describedby={fieldErrors.state ? "state-e" : undefined}
                    className={inputClass(fieldErrors.state)}
                  >
                    <option value="" disabled>
                      Choose
                    </option>
                    {US_STATES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.state && <FieldError id="state-e">{fieldErrors.state}</FieldError>}
                </div>
                <Field className="sm:col-span-2" label="ZIP code" name="postalCode" inputMode="numeric" autoComplete="shipping postal-code" defaultValue={address?.postalCode} error={fieldErrors.postalCode} />
                <Field className="sm:col-span-6" label="Phone" name="phone" optional type="tel" autoComplete="shipping tel" defaultValue={address?.phone ?? ""} error={fieldErrors.phone} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">United States only. We&apos;ll save this address for next time.</p>
            </div>

            <div hidden={step !== 2} className={panelClass}>
              <fieldset>
                <legend className="sr-only">Delivery speed</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {speeds.map((s) => (
                    <label
                      key={s.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/70 p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-smooth has-focus-visible:ring-3 has-focus-visible:ring-ring/40 active:scale-[0.99]",
                        speed === s.value ? "border-primary bg-white shadow-sm" : "border-input hover:bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name="speedChoice"
                        value={s.value}
                        checked={speed === s.value}
                        onChange={() => setSpeed(s.value)}
                        className="mt-1 size-4 accent-primary focus-visible:outline-none"
                      />
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
            </div>

            <div hidden={step !== 3} className={panelClass}>
              <dl className="mb-5 grid gap-4 rounded-2xl bg-white/60 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="flex items-center justify-between text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Ship to
                    <button type="button" onClick={() => go(1)} className={`rounded-md text-xs font-medium tracking-normal text-foreground normal-case underline-offset-2 hover:underline ${ring}`}>
                      Edit<span className="sr-only"> address</span>
                    </button>
                  </dt>
                  <dd className="mt-1 leading-relaxed">
                    {recap.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center justify-between text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Delivery
                    <button type="button" onClick={() => go(2)} className={`rounded-md text-xs font-medium tracking-normal text-foreground normal-case underline-offset-2 hover:underline ${ring}`}>
                      Edit<span className="sr-only"> delivery</span>
                    </button>
                  </dt>
                  <dd className="mt-1">
                    {chosen.label} · {chosen.cost}
                    <span className="block text-muted-foreground">
                      <DeliveryDate dispatchDaysMin={dispatch.min} dispatchDaysMax={dispatch.max} transitDays={chosen.transit} format="long" />
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-dashed border-input bg-white/60 p-3.5 text-sm">
                <CreditCardIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                <p>
                  {paymentNote ?? (
                    <>
                      <b>Simulated payment: no real money moves.</b> Use <span className="font-mono">4242 4242 4242 4242</span> with any future date and
                      CVC. <span className="font-mono">4000 0000 0000 9995</span> shows an insufficient-funds decline. Real card numbers are refused.
                    </>
                  )}
                </p>
              </div>
              {renderPayment(cardError)}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => go((step - 1) as Step)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-black/5 ${ring}`}>
                <ArrowLeftIcon aria-hidden className="size-4" /> Back
              </button>
            ) : (
              <Link href="/cart" className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-black/5 ${ring}`}>
                <ArrowLeftIcon aria-hidden className="size-4" /> Back to cart
              </Link>
            )}
            {step < 3 ? (
              <button
                type="submit"
                className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 ${ring}`}
              >
                Continue to {STEPS[step as 1 | 2].short.toLowerCase()}
                <ArrowRightIcon aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-brand-foreground transition-[background-color,opacity] hover:bg-brand/90 disabled:opacity-70 ${ring}`}
              >
                {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <LockIcon aria-hidden className="size-4" />}
                {pending ? "Placing your order…" : `Place your order · ${formatMoney(totals.totalCents)}`}
              </button>
            )}
          </div>
        </section>
      </div>

      <aside aria-label="Order summary" className="mt-6 lg:sticky lg:top-24 lg:mt-0">
        <div className="glass flex flex-col gap-4 rounded-3xl p-5">
          <h2 className="font-semibold tracking-tight">Order summary</h2>
          <ul className="flex flex-col gap-3">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 text-sm">
                <span className="relative size-12 shrink-0 rounded-xl bg-white/80">
                  <Image src={l.thumbnail} alt="" fill sizes="48px" className="rounded-xl object-contain p-1" />
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {l.quantity}
                  </span>
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
              <dd key={totals.shippingCents} className="tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
                {totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Estimated tax ({Math.round(TAX_RATE * 100)}%)</dt>
              <dd className="tabular-nums">{formatMoney(totals.taxCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Order total</dt>
              <dd
                key={totals.totalCents}
                aria-live="polite"
                className="tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
              >
                {formatMoney(totals.totalCents)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Prices and stock are checked again when you place the order.</p>
        </div>
      </aside>
    </form>
  );
}
