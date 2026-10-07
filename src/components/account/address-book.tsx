"use client";

import { startTransition, useActionState, useEffect, useId, useState, useTransition } from "react";
import { AlertCircleIcon, CheckIcon, LoaderCircleIcon, MapPinIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction, type AddressFormState } from "@/app/account/actions";
import { US_STATES } from "@/lib/address";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";
const input = (err?: string) =>
  cn("h-11 w-full rounded-xl border bg-white/90 px-3.5 text-base text-foreground sm:text-sm", ring, err ? "border-sale" : "border-input");

export type SavedAddress = {
  id: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
  isDefault: boolean;
};

function Field({ label, name, err, optional, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; err?: string; optional?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </label>
      <input id={id} name={name} aria-invalid={!!err} aria-describedby={err ? `${id}-e` : undefined} className={input(err)} {...rest} />
      {err && (
        <p id={`${id}-e`} className="flex items-center gap-1 text-xs font-medium text-sale">
          <AlertCircleIcon aria-hidden className="size-3.5" /> {err}
        </p>
      )}
    </div>
  );
}

function AddressForm({ address, onDone }: { address?: SavedAddress; onDone: () => void }) {
  const [state, action, pending] = useActionState<AddressFormState, FormData>(saveAddressAction, null);
  const fe = state?.fieldErrors ?? {};
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form
      // Submitted manually so a validation error doesn't reset what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      noValidate
      className="grid gap-4 rounded-2xl bg-white/60 p-4 sm:grid-cols-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300">
      {address && <input type="hidden" name="id" value={address.id} />}
      <Field className="sm:col-span-6" label="Full name" name="fullName" autoComplete="name" defaultValue={address?.fullName} err={fe.fullName} />
      <Field className="sm:col-span-6" label="Street address" name="line1" autoComplete="address-line1" defaultValue={address?.line1} err={fe.line1} />
      <Field className="sm:col-span-6" label="Apartment, suite, etc." name="line2" optional autoComplete="address-line2" defaultValue={address?.line2 ?? ""} />
      <Field className="sm:col-span-2" label="City" name="city" autoComplete="address-level2" defaultValue={address?.city} err={fe.city} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={`state-${address?.id ?? "new"}`} className="text-sm font-medium">
          State
        </label>
        <select id={`state-${address?.id ?? "new"}`} name="state" defaultValue={address?.state ?? ""} aria-invalid={!!fe.state} className={input(fe.state)}>
          <option value="" disabled>
            Choose…
          </option>
          {US_STATES.map(([c, n]) => (
            <option key={c} value={c}>
              {n}
            </option>
          ))}
        </select>
        {fe.state && <p className="text-xs font-medium text-sale">{fe.state}</p>}
      </div>
      <Field className="sm:col-span-2" label="ZIP code" name="postalCode" inputMode="numeric" autoComplete="postal-code" defaultValue={address?.postalCode} err={fe.postalCode} />
      <Field className="sm:col-span-6" label="Phone" name="phone" type="tel" optional autoComplete="tel" defaultValue={address?.phone ?? ""} err={fe.phone} />
      {!address?.isDefault && (
        <label className="flex items-center gap-2 text-sm sm:col-span-6">
          <input type="checkbox" name="makeDefault" className="size-4 accent-primary" /> Make this my default address
        </label>
      )}
      <div className="flex gap-2 sm:col-span-6">
        <button type="submit" disabled={pending} className={`inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60 ${ring}`}>
          {pending && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
          {pending ? "Saving…" : address ? "Save changes" : "Save address"}
        </button>
        <button type="button" onClick={onDone} className={`h-10 rounded-full px-4 text-sm font-medium hover:bg-black/5 ${ring}`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressCard({ a, onEdit }: { a: SavedAddress; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className={cn("flex flex-col gap-3 rounded-2xl border bg-white/70 p-4 text-sm transition-opacity", a.isDefault ? "border-primary" : "border-input", pending && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <address className="leading-relaxed not-italic">
          <b className="font-semibold">{a.fullName}</b>
          <br />
          {a.line1}
          {a.line2 && `, ${a.line2}`}
          <br />
          {a.city}, {a.state} {a.postalCode}
          {a.phone && (
            <>
              <br />
              <span className="text-muted-foreground">{a.phone}</span>
            </>
          )}
        </address>
        {a.isDefault && <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">Default</span>}
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={`Delete the address for ${a.fullName}?`}>
          <span className="font-medium">Delete this address?</span>
          <button type="button" onClick={() => start(() => deleteAddressAction(a.id))} className={`h-8 rounded-full bg-sale px-3 text-xs font-semibold text-white ${ring}`}>
            Yes, delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={`h-8 rounded-full px-3 text-xs font-medium hover:bg-black/5 ${ring}`}>
            Keep it
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" onClick={onEdit} className={`inline-flex items-center gap-1 rounded-md font-medium text-foreground/75 hover:text-foreground ${ring}`}>
            <PencilIcon aria-hidden className="size-3.5" /> Edit<span className="sr-only"> address for {a.fullName}</span>
          </button>
          {!a.isDefault && (
            <button type="button" onClick={() => start(() => setDefaultAddressAction(a.id))} className={`inline-flex items-center gap-1 rounded-md font-medium text-foreground/75 hover:text-foreground ${ring}`}>
              <StarIcon aria-hidden className="size-3.5" /> Set as default
            </button>
          )}
          <button type="button" onClick={() => setConfirming(true)} className={`inline-flex items-center gap-1 rounded-md font-medium text-foreground/75 hover:text-sale ${ring}`}>
            <Trash2Icon aria-hidden className="size-3.5" /> Delete
          </button>
        </div>
      )}
    </li>
  );
}

export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  const [saved, setSaved] = useState(false);
  const done = () => {
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };
  return (
    <section aria-labelledby="addresses" className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="addresses" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <MapPinIcon aria-hidden className="size-5" /> Your addresses
        </h2>
        <p role="status" className="text-sm text-stock">
          {saved && (
            <>
              <CheckIcon aria-hidden className="mr-1 inline size-4" /> Saved
            </>
          )}
        </p>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="sm:col-span-2">
              <AddressForm address={a} onDone={done} />
            </li>
          ) : (
            <AddressCard key={a.id} a={a} onEdit={() => setEditing(a.id)} />
          ),
        )}
      </ul>
      <div className="mt-4">
        {editing === "new" ? (
          <AddressForm onDone={done} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={`inline-flex h-10 items-center gap-2 rounded-full border border-dashed border-input px-4 text-sm font-medium transition-colors hover:bg-white/70 ${ring}`}
          >
            <PlusIcon aria-hidden className="size-4" /> Add an address
          </button>
        )}
      </div>
    </section>
  );
}
