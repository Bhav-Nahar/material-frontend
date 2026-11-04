"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { nextScrollState } from "@/lib/scrollDirection";

/**
 * Back to top -- visible only while the page is being scrolled UP.
 *
 * The rule and its reasoning live in lib/scrollDirection, which is where the dead zone is tested.
 * This is the button.
 *
 * IT LIVES IN FloatingContact'S COLUMN rather than claiming a corner of its own. That stack already
 * solves the two problems a third fixed element would have had to solve again: it clears the fixed
 * bottom bars the PDP and PLP put on small screens, and it carries the data-floating-contact hook
 * the lighting preview uses to get these out of the way of its slider on a phone. A second floating
 * anchor point would also mean two things in the bottom-right corner disagreeing about where the
 * bottom-right corner is.
 *
 * NOT `hidden`, a fade: display:none has nothing to transition, and this appears and disappears on
 * a gesture people make constantly. It is taken out of the tab order and hidden from screen readers
 * while it is invisible, so keyboard focus cannot land on a button nobody can see.
 *
 * ABSOLUTE, ABOVE the column rather than a flex child of it. Faded-out is still laid out, so as a
 * child it would hold a permanent 48px slot and park the call button a button's height higher on
 * every page for the sake of a control that is usually not there. `bottom-full` hangs it off the
 * top of the stack and out of the flow, so the buttons that are always present never move.
 */
export default function BackToTop() {
  const [shown, setShown] = useState(false);

  /* The rule needs the CURRENT answer to decide the next one, and a setState updater is the wrong
     place to get it: React double-invokes updaters in StrictMode, so advancing `last` in there ran
     the reference forward twice and the second pass saw a delta of zero -- the button never
     appeared at all. A ref keeps the reading outside the updater, where a side effect is allowed. */
  const shownRef = useRef(false);

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;

    const check = () => {
      raf = 0;
      const next = nextScrollState({
        y: window.scrollY,
        last,
        shown: shownRef.current,
        viewportH: window.innerHeight,
      });
      last = next.last;
      shownRef.current = next.shown;
      setShown(next.shown);
    };

    // One rect-free read per frame, the same shape as the header's listener. React bails out when
    // the boolean is unchanged, so scrolling costs no re-render.
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <button
      type="button"
      // SMOOTH (user, 2026-09-05), unless the OS asked for reduced motion. Asked for here rather
      // than by a global `scroll-behavior: smooth`, which also animated back/forward restoration.
      //
      // The glide cannot strobe the button on the way, which is the one thing worth checking about
      // animating this particular control: the whole trip is upward travel, so the direction rule
      // keeps it visible until it crosses back inside the first screen and the button retires.
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        })
      }
      aria-label="Back to top"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className={`absolute bottom-full right-0 mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        shown ? "" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
