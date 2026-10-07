"use client";

import { useActionState, useId, useState } from "react";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { demoSignInAction, signInAction, signUpAction, type AuthFormState } from "@/app/signin/actions";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && show ? "text" : type}
          spellCheck={type === "email" || isPassword ? false : undefined}
          autoCapitalize={type === "email" || isPassword ? "none" : undefined}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-xl border bg-white/90 px-3.5 text-base text-foreground transition-shadow focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none sm:text-sm",
            error ? "border-sale" : "border-input",
            isPassword && "pr-12",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className={`absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-black/5 ${ring}`}
          >
            {show ? <EyeOffIcon aria-hidden className="size-4" /> : <EyeIcon aria-hidden className="size-4" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-sale">
          {error}
        </p>
      )}
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60 ${ring}`}
    >
      {pending && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function FormError({ state }: { state: AuthFormState }) {
  return (
    <p role="alert" className={cn("text-sm font-medium text-sale", !state?.error && "sr-only")}>
      {state?.error}
    </p>
  );
}

export function AuthForms({ next, initialTab }: { next: string; initialTab: "signin" | "create" }) {
  const [tab, setTab] = useState(initialTab);
  const [signInState, signInFormAction, signingIn] = useActionState<AuthFormState, FormData>(signInAction, null);
  const [signUpState, signUpFormAction, signingUp] = useActionState<AuthFormState, FormData>(signUpAction, null);

  const tabs = [
    ["signin", "Sign in"],
    ["create", "Create account"],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-full bg-black/5 p-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-full text-sm font-medium transition-colors",
              ring,
              tab === key ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form id="panel-signin" role="tabpanel" aria-labelledby="tab-signin" hidden={tab !== "signin"} action={signInFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={signInState?.values?.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        <FormError state={signInState} />
        <Submit pending={signingIn}>Sign in</Submit>
      </form>

      <form id="panel-create" role="tabpanel" aria-labelledby="tab-create" hidden={tab !== "create"} action={signUpFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Your name" name="name" autoComplete="name" defaultValue={signUpState?.values?.name} error={signUpState?.fieldErrors?.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={signUpState?.values?.email} error={signUpState?.fieldErrors?.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={signUpState?.fieldErrors?.password}
          hint="At least 8 characters."
        />
        <FormError state={signUpState} />
        <Submit pending={signingUp}>Create account</Submit>
        <p className="text-xs text-muted-foreground">This is a demo store. Don&apos;t reuse a real password.</p>
      </form>
    </div>
  );
}

export function DemoSignIn({ next, email, password }: { next: string; email: string; password: string }) {
  const [, action, pending] = useActionState(async (_: null, fd: FormData) => {
    await demoSignInAction(fd);
    return null;
  }, null);
  return (
    <form action={action} className="rounded-2xl border border-dashed border-input bg-white/60 p-4">
      <input type="hidden" name="next" value={next} />
      <p className="text-sm font-medium">Just looking around?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Use the shared demo account: <span className="font-mono">{email}</span> / <span className="font-mono">{password}</span>
      </p>
      <button
        type="submit"
        disabled={pending}
        className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60 ${ring}`}
      >
        {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <SparklesIcon aria-hidden className="size-4" />}
        Try the demo account
      </button>
    </form>
  );
}
