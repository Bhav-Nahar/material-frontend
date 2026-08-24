"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ANNOUNCEMENTS, ANNOUNCEMENTS_VISIBLE } from "@/data/announcements";

/**
 * The announcement bar. Rotates every 10s; the arrows step it by hand.
 *
 * ponytail: useState + one interval, not Swiper. This bar is in the header of EVERY page, and it
 * was the only reason swiper's JS and CSS rode in the checkout and account bundles -- a vertical
 * ticker of three sentences does not need a gesture engine.
 */
export default function TopBar() {
  const announcements = ANNOUNCEMENTS;
  const [index, setIndex] = useState(0);
  const count = announcements.length;

  const step = (by) => setIndex((i) => (i + by + count) % count);

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 10000);
    return () => clearInterval(id);
    // Restart the timer on a manual step, so an arrow click gets its full 10s on screen.
  }, [count, index]);

  if (!ANNOUNCEMENTS_VISIBLE || count === 0) return null;

  const content = (item) =>
    item.url ? (
      <Link
        prefetch={false}
        href={item.url}
        className="flex h-full w-full items-center justify-center px-6 text-center text-sm font-medium leading-none tracking-[0.7px] hover:underline"
      >
        {item.text}
      </Link>
    ) : (
      <p className="flex h-full w-full items-center justify-center px-12 text-center text-sm font-medium leading-none tracking-[0.7px]">
        {item.text}
      </p>
    );

  return (
    <div className="group relative h-10 overflow-hidden bg-[var(--charcoal)] text-white">
      {/* p-2 -m-1 pads the tap target past the 16px glyph without shifting the layout. */}
      <button
        aria-label="Previous announcement"
        onClick={() => step(-1)}
        className="absolute left-2 top-1/2 z-20 -m-1 flex -translate-y-1/2 cursor-pointer items-center justify-center p-2 transition-opacity"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>

      {/* The whole stack slides vertically; only the current row is in view. */}
      <div
        className="transition-transform duration-500 ease-in-out"
        style={{ transform: `translateY(-${index * 2.5}rem)` }}
        aria-live="polite"
      >
        {announcements.map((item, i) => (
          <div key={i} className="flex h-10 items-center justify-center" aria-hidden={i !== index}>
            {content(item)}
          </div>
        ))}
      </div>

      <button
        aria-label="Next announcement"
        onClick={() => step(1)}
        className="absolute right-2 top-1/2 z-20 -m-1 flex -translate-y-1/2 cursor-pointer items-center justify-center p-2 transition-opacity"
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
