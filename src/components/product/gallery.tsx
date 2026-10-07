"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Desktop: big image with thumbnails underneath. Mobile: swipeable images with
 * dots. Both share the same index so they never disagree.
 */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const shown = images.slice(0, 6);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: swipe */}
      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl bg-white/80 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        aria-label={`${title} images`}
      >
        {shown.map((src, i) => (
          <div key={src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image src={src} alt={i === 0 ? title : `${title}, image ${i + 1}`} fill priority={i === 0} sizes="100vw" className="object-contain p-8" />
          </div>
        ))}
      </div>
      {shown.length > 1 && (
        <div className="flex justify-center gap-1.5 lg:hidden" aria-hidden>
          {shown.map((src, i) => (
            <span key={src} className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-primary" : "bg-black/20")} />
          ))}
        </div>
      )}

      {/* Desktop: main + thumbnails */}
      <div className="relative hidden aspect-square overflow-hidden rounded-3xl bg-white/80 lg:block">
        <Image key={shown[index]} src={shown[index]} alt={title} fill priority sizes="(min-width: 1024px) 560px, 100vw" className="animate-in fade-in object-contain p-10 duration-200" />
      </div>
      {shown.length > 1 && (
        <div className="hidden gap-2 lg:flex" role="group" aria-label="Choose image">
          {shown.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "relative aspect-square w-16 overflow-hidden rounded-xl bg-white/80 ring-2 transition-shadow focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                i === index ? "ring-primary" : "ring-transparent hover:ring-black/15",
              )}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
