"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import ProductCard from "./ProductCard";

/**
 * Horizontal product rail: 2.15 cards on a phone up to 4 on a wide screen, a progress track and
 * round arrows below.
 *
 * NATIVE SCROLL-SNAP, NOT SWIPER (audited 2026-09-05). This was Swiper with FreeMode, Navigation
 * and Pagination, three stylesheets and a 28-line CSS workaround -- for a row of cards that scrolls
 * sideways, which is `overflow-x-auto` plus `snap-x`. ProductGallery reached the same conclusion for
 * the mobile image rail and says so in its own note; this is the other half of that decision.
 *
 * THE WORKAROUND IS THE POINT. Swiper writes slide widths INLINE on init, so before its JavaScript
 * runs every card is full-container width and the row reflows the moment it does -- worst on a
 * back-navigation, where the markup is restored from cache and init runs again. `.rail-presize` in
 * globals.css existed only to pre-guess those widths and cancel the shift. A CSS-sized row has no
 * init, so there is no shift to cancel and the whole hack goes with the library. The three width
 * formulas below ARE that hack's formulas, moved onto the element they were always describing.
 *
 * Swiper stays in the project -- ProductCard's per-card image swipe and the homepage banner still
 * use it -- it just stops being involved in a row of cards.
 *
 * WHAT THE ARROWS DO IS UNCHANGED: one viewport of cards per press, snapping to a card edge, and
 * disabled at the ends. `scrollBy` with the container's own width is the same page Swiper's
 * navigation turned, without a library to ask.
 */

/** `list` is analytics only -- it names which rail this is, so "related" and "recently viewed"
 *  impressions do not merge into one number. See ProductCard. */
export default function ProductRail({ products = [], priorityCount = 2, list = "rail" }) {
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /* One read per frame, the shape every scroll listener on this site uses. `- 1` on the end test
     because a fully scrolled track lands a fraction short on fractional-pixel widths and a button
     that never quite disables is worse than one that disables a pixel early. */
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    // ResizeObserver rather than a window listener: the rail's width changes when the SIDEBAR or a
    // filter panel opens, not only when the window does, and its first callback covers the initial
    // measurement without a setState in the effect body.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  const page = (direction) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      {/*
        WHY THIS CLASS LIST IS SO CAREFUL. Swiper never scrolled anything -- it clipped with
        `overflow: hidden` and moved the track with a transform, so the rail was NEVER a scroll
        container. This one is, and a scroll container sitting under the cursor is a thing that can
        SWALLOW A VERTICAL WHEEL instead of passing it up to the page. That is exactly what it did:
        with the pointer over a card the page would not scroll at all (user, 2026-09-06).

        Three things had to go, all of them mine and none of them replacing anything Swiper did:

          - `overscroll-x-contain` -- overscroll-behavior's entire job is to STOP scroll chaining.
            It belongs on a nested scroller inside another scroller, so a swipe that runs out of
            track does not drag the parent. This rail's parent is the page, and stopping chaining to
            the page is the bug, not a feature.
          - `snap-mandatory` -- a mandatory snap container is entitled to consume a scroll to keep
            itself snapped. `proximity` still snaps to a card when you let go and never insists,
            which is also closer to the `freeMode: { sticky: true }` Swiper ran here.
          - the implicit vertical scroll port -- `overflow-x: auto` makes the OTHER axis compute to
            `auto` too (CSS: one axis non-visible forces the other off `visible`). `overflow-y-clip`
            says what was always meant: clip vertically, never scroll, never accept a wheel.
      */}
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-clip md:gap-4 xl:gap-6"
      >
        {products.map((product, i) => (
          <div
            key={product.handle}
            /* Swiper's own sizing formula -- (track - gaps) / slidesPerView -- so the card widths
               are identical to what it used to compute at runtime. */
            className="w-[calc((100%-13.8px)/2.15)] shrink-0 snap-start md:w-[calc((100%-32px)/3)] xl:w-[calc((100%-72px)/4)]"
          >
            <ProductCard product={product} priority={i < priorityCount} list={list} index={i} />
          </div>
        ))}
      </div>

      <div className="mt-7 flex items-center justify-between gap-6">
        {/* Progress track: a hairline with a filled portion, scaled from the real scroll offset. */}
        <div className="relative h-px w-full max-w-30 grow bg-line lg:max-w-50">
          <div
            className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={atStart}
            aria-label="Previous products"
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-line-strong bg-surface text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-ink"
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={atEnd}
            aria-label="Next products"
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-line-strong bg-surface text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-ink"
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
