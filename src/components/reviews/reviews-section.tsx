"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useState } from "react";
import { AlertCircleIcon, BadgeCheckIcon, CheckIcon, LoaderCircleIcon, PencilLineIcon, StarIcon } from "lucide-react";
import { ownReviewAction, submitReviewAction, type ReviewFormState } from "@/app/p/[slug]/actions";
import { cn } from "@/lib/utils";

const ring = "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export type ReviewView = {
  id: number;
  authorName: string;
  rating: number;
  title: string | null;
  comment: string;
  verified: boolean;
  createdAt: string;
};

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={cn("size-[1em] fill-current", i <= Math.round(rating) ? "text-star" : "text-star/25")} />
      ))}
    </span>
  );
}

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Accessible star picker: a radio group whose labels are stars. */
function StarPicker({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset aria-describedby={error ? "rating-err" : undefined}>
      <legend className="text-sm font-medium">Your rating</legend>
      <div className="mt-1 flex items-center gap-2" onMouseLeave={() => setHover(0)}>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-0.5 has-focus-visible:ring-3 has-focus-visible:ring-ring/40" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
              <StarIcon aria-hidden className={cn("size-7 transition-[transform,color] duration-150", n <= shown ? "scale-105 fill-star text-star" : "fill-transparent text-star/40")} />
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}, {LABELS[n]}
              </span>
            </label>
          ))}
        </div>
        <span className="text-sm text-muted-foreground" aria-hidden>
          {LABELS[shown]}
        </span>
      </div>
      {error && (
        <p id="rating-err" className="mt-1 flex items-center gap-1 text-xs font-medium text-sale">
          <AlertCircleIcon aria-hidden className="size-3.5" /> {error}
        </p>
      )}
    </fieldset>
  );
}

function ReviewForm({ productId, onDone }: { productId: number; onDone: (msg: string, review: NonNullable<ReviewFormState>["review"], updated: boolean) => void }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReviewAction, null);
  const [rating, setRating] = useState(0);
  const [initial, setInitial] = useState<{ title: string; comment: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const titleId = useId();
  const bodyId = useId();
  const fe = state?.fieldErrors ?? {};

  useEffect(() => {
    let live = true;
    ownReviewAction(productId).then((r) => {
      if (!live) return;
      if (!r.signedIn) return router.push(`/signin?next=${encodeURIComponent(`${pathname}#reviews`)}`);
      if (r.review) {
        setRating(r.review.rating);
        setInitial({ title: r.review.title ?? "", comment: r.review.comment });
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [productId, pathname, router]);

  useEffect(() => {
    if (state?.signin) router.push(`/signin?next=${encodeURIComponent(`${pathname}#reviews`)}`);
    if (state?.ok) {
      onDone(state.updated ? "Your review was updated." : state.verified ? "Thanks! Your verified review is live." : "Thanks! Your review is live.", state.review, !!state.updated);
    }
  }, [state, router, pathname, onDone]);

  if (!loaded) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> Loading the review form…
      </p>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      noValidate
      className="mt-4 flex flex-col gap-4 rounded-2xl bg-white/70 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
    >
      <input type="hidden" name="productId" value={productId} />
      <StarPicker value={rating} onChange={setRating} error={fe.rating} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-sm font-medium">
          Headline
        </label>
        <input
          id={titleId}
          name="title"
          defaultValue={initial?.title}
          maxLength={80}
          placeholder="e.g. Great sound for the price…"
          aria-invalid={!!fe.title}
          className={cn("h-11 rounded-xl border bg-white px-3.5 text-base text-foreground sm:text-sm", ring, fe.title ? "border-sale" : "border-input")}
        />
        {fe.title && <p className="text-xs font-medium text-sale">{fe.title}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={bodyId} className="text-sm font-medium">
          Your review
        </label>
        <textarea
          id={bodyId}
          name="comment"
          rows={4}
          maxLength={2000}
          defaultValue={initial?.comment}
          placeholder="What did you like or dislike? How did you use it?…"
          aria-invalid={!!fe.comment}
          className={cn("rounded-xl border bg-white px-3.5 py-2.5 text-sm text-foreground", ring, fe.comment ? "border-sale" : "border-input")}
        />
        {fe.comment && <p className="text-xs font-medium text-sale">{fe.comment}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60 ${ring}`}
      >
        {pending && <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
        {pending ? "Posting…" : initial ? "Update review" : "Post review"}
      </button>
    </form>
  );
}

export function ReviewsSection({
  productId,
  rating,
  ratingCount: baseCount,
  reviews: baseReviews,
}: {
  productId: number;
  rating: number;
  ratingCount: number;
  reviews: ReviewView[];
}) {
  const [filter, setFilter] = useState<number | null>(null);
  const [writing, setWriting] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);
  // The author's own review shows at once; the cached page catches up in the background.
  const [mine, setMine] = useState<ReviewView | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const reviews = mine ? [mine, ...baseReviews] : baseReviews;
  const ratingCount = baseCount + addedCount;
  const counts = [5, 4, 3, 2, 1].map((s) => [s, reviews.filter((r) => r.rating === s).length] as const);
  const shown = filter ? reviews.filter((r) => r.rating === filter) : reviews;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-16 scroll-mt-24 lg:grid lg:grid-cols-[280px_1fr] lg:gap-12">
      <div>
        <h2 id="reviews-heading" className="text-lg font-semibold tracking-tight">
          Customer reviews
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-4xl font-semibold tabular-nums">{rating.toFixed(1)}</span>
          <div>
            <Stars rating={rating} className="text-base" />
            <p className="text-xs text-muted-foreground">{ratingCount.toLocaleString("en-US")} ratings</p>
          </div>
        </div>
        {reviews.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5" aria-label="Written reviews by star rating">
            {counts.map(([s, n]) => {
              const pct = Math.round((n / reviews.length) * 100);
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setFilter(filter === s ? null : s)}
                    disabled={n === 0}
                    aria-pressed={filter === s}
                    className={cn("flex w-full items-center gap-2 rounded-md text-xs transition-opacity disabled:opacity-40", ring, filter && filter !== s && "opacity-50")}
                  >
                    <span className="w-10 text-left">{s} star</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                      <span className="block h-full rounded-full bg-star transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 text-right text-muted-foreground tabular-nums">{pct}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Breakdown of {reviews.length} written review{reviews.length === 1 ? "" : "s"}
        </p>

        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-medium">Own this product?</p>
          <p className="text-xs text-muted-foreground">Share what you think with other shoppers.</p>
          <button
            type="button"
            onClick={() => {
              setWriting((w) => !w);
              setThanks(null);
            }}
            aria-expanded={writing}
            className={`mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-input bg-white/70 px-5 text-sm font-medium transition-colors hover:bg-white ${ring}`}
          >
            <PencilLineIcon aria-hidden className="size-4" /> {writing ? "Close" : "Write a review"}
          </button>
          <p role="status" className="mt-2 text-sm text-stock">
            {thanks && (
              <>
                <CheckIcon aria-hidden className="mr-1 inline size-4" />
                {thanks}
              </>
            )}
          </p>
          {writing && (
            <ReviewForm
              productId={productId}
              onDone={(m, review, updated) => {
                setWriting(false);
                setThanks(m);
                if (review && !updated) setMine({ id: -1, authorName: "You", rating: review.rating, title: review.title, comment: review.comment, verified: review.verified, createdAt: new Date().toISOString() });
                if (!updated) setAddedCount(1);
              }}
            />
          )}
        </div>
      </div>

      <div className="mt-8 lg:mt-0">
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter reviews by stars">
          {[null, 5, 4, 3, 2, 1].map((s) => {
            const n = s ? reviews.filter((r) => r.rating === s).length : reviews.length;
            return (
              <button
                key={s ?? "all"}
                type="button"
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                disabled={s !== null && n === 0}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-40",
                  ring,
                  filter === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-white/70 hover:bg-white",
                )}
              >
                {s ? (
                  <>
                    {s}
                    <StarIcon aria-hidden className="size-3 fill-current" />
                  </>
                ) : (
                  "All"
                )}
                <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
        <ul className="flex flex-col divide-y divide-border" aria-live="polite">
          {shown.map((r) => (
            <li key={r.id} className="py-5 first:pt-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span aria-hidden className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                  {r.authorName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="font-medium">{r.authorName}</span>
                <span className="text-muted-foreground">· {fmt.format(new Date(r.createdAt))}</span>
                {r.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-stock/10 px-2 py-0.5 text-xs font-semibold text-stock">
                    <BadgeCheckIcon aria-hidden className="size-3.5" /> Verified purchase
                  </span>
                )}
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Stars rating={r.rating} className="text-xs" />
                <span className="sr-only">{r.rating} out of 5 stars.</span>
                {r.title && <b className="font-semibold">{r.title}</b>}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{r.comment}</p>
            </li>
          ))}
          {shown.length === 0 && <li className="py-5 text-sm text-muted-foreground">No written reviews yet. Be the first to write one.</li>}
        </ul>
      </div>
    </section>
  );
}
