"use client";

import { useActionState } from "react";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { updateNameAction, type NameFormState } from "@/app/account/actions";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<NameFormState, FormData>(updateNameAction, null);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <label htmlFor="acct-name" className="text-sm font-medium">
        Name
      </label>
      <div className="flex gap-2">
        <input
          id="acct-name"
          name="name"
          defaultValue={name}
          autoComplete="name"
          aria-invalid={!!state?.error}
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-white/90 px-3.5 text-base text-foreground focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none sm:text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        >
          {pending && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p role="status" className="min-h-4 text-xs">
        {state?.error && <span className="font-medium text-sale">{state.error}</span>}
        {state?.ok && (
          <span className="text-stock">
            <CheckIcon aria-hidden className="mr-1 inline size-3.5" />
            Name updated
          </span>
        )}
      </p>
    </form>
  );
}
