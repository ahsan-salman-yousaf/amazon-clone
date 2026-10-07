"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, LoaderCircleIcon, SendIcon } from "lucide-react";
import { sendContactMessage, type ContactState } from "@/app/contact/actions";
import { CONTACT_TOPICS, TOPICS_WITH_ORDER, type ContactTopic } from "@/lib/contact";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none";
const control = (err?: string) => cn("w-full rounded-xl border bg-white/90 px-3.5 text-base text-foreground sm:text-sm", ring, err ? "border-sale" : "border-input");

function Err({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="flex items-center gap-1 text-xs font-medium text-sale motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <AlertCircleIcon aria-hidden className="size-3.5 shrink-0" /> {children}
    </p>
  );
}

export function ContactForm({ defaultName, defaultEmail }: { defaultName?: string; defaultEmail?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactMessage, null);
  const [topic, setTopic] = useState<ContactTopic | "">("");
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const fe = state && !state.ok ? state.fieldErrors : {};
  const needsOrder = topic !== "" && TOPICS_WITH_ORDER.includes(topic);

  // Move focus to the first field with a problem.
  useEffect(() => {
    if (!state || state.ok) return;
    const order = ["name", "email", "topic", "orderNumber", "message"] as const;
    const first = order.find((f) => state.fieldErrors[f]);
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div role="status" className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
        <CheckCircle2Icon aria-hidden className="size-10 text-stock" />
        <h2 className="text-xl font-semibold tracking-tight">Message received</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thanks for reaching out. Your reference is <b className="font-mono text-foreground">{state.reference}</b>. Mention it if you write again.
        </p>
        <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-brand hover:text-brand-foreground">
          Back to shopping
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={form}
      noValidate
      // Submitted manually so a validation error doesn't clear what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="glass grid gap-4 rounded-3xl p-5 sm:grid-cols-2 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Your name
        </label>
        <input id={`${id}-name`} name="name" autoComplete="name" defaultValue={defaultName} aria-invalid={!!fe.name} aria-describedby={`${id}-name-e`} className={cn(control(fe.name), "h-11")} />
        <Err id={`${id}-name-e`}>{fe.name}</Err>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className="text-sm font-medium">
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          defaultValue={defaultEmail}
          aria-invalid={!!fe.email}
          aria-describedby={`${id}-email-e`}
          className={cn(control(fe.email), "h-11")}
        />
        <Err id={`${id}-email-e`}>{fe.email}</Err>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-topic`} className="text-sm font-medium">
          What is it about?
        </label>
        <select
          id={`${id}-topic`}
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          aria-invalid={!!fe.topic}
          aria-describedby={`${id}-topic-e`}
          className={cn(control(fe.topic), "h-11 bg-white")}
        >
          <option value="" disabled>
            Choose a topic…
          </option>
          {Object.entries(CONTACT_TOPICS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Err id={`${id}-topic-e`}>{fe.topic}</Err>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-order`} className="text-sm font-medium">
          Order number <span className="font-normal text-muted-foreground">{needsOrder ? "(required)" : "(optional)"}</span>
        </label>
        <input
          id={`${id}-order`}
          name="orderNumber"
          autoComplete="off"
          spellCheck={false}
          placeholder="OC-7K3P-92QX…"
          aria-invalid={!!fe.orderNumber}
          aria-describedby={`${id}-order-e`}
          className={cn(control(fe.orderNumber), "h-11 font-mono uppercase placeholder:font-sans placeholder:normal-case")}
        />
        <Err id={`${id}-order-e`}>{fe.orderNumber}</Err>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={`${id}-message`} className="text-sm font-medium">
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={6}
          maxLength={3000}
          placeholder="How can we help? The more detail, the faster we can sort it out…"
          aria-invalid={!!fe.message}
          aria-describedby={`${id}-message-e`}
          className={cn(control(fe.message), "py-2.5")}
        />
        <Err id={`${id}-message-e`}>{fe.message}</Err>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <p className="text-xs text-muted-foreground">We reply within one business day. This is a demo store, so no one will actually write back.</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold whitespace-nowrap text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : <SendIcon aria-hidden className="size-4" />}
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
