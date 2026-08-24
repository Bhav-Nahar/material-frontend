"use client";

import { useEffect, useState } from "react";

import TopBar from "./TopBar";
import MainHeader from "./MainHeader";
import Navbar from "./Navbar";
import MobileHeader from "./MobileHeader";

import { cn } from "@/lib/utils";

/**
 * Adapted from the jewelry build's Header.jsx. Two changes, both for performance:
 *
 * 1. The mobile/desktop split is CSS, not JS.
 *    The jewelry build branches on `useMediaQuery("(max-width: 1023px)")`, which is `false` during
 *    SSR because there is no window. So a phone receives the DESKTOP header in the HTML and swaps
 *    to the mobile one after hydration -- a guaranteed layout shift on every mobile load, on a site
 *    where §12 assumes most browsing is on a phone. Rendering both and hiding with `lg:` costs a
 *    few hundred bytes and shifts nothing.
 *
 * 2. Jewelry route special-cases removed -- /build-your-jewelry, /dashboard, store-giveaway.
 *
 * THE COLLAPSE IS CSS NOW, NOT FRAMER-MOTION (user, 2026-08-24), and that is a bug fix rather than
 * a tidy-up. It used to be `<motion.div animate={{ height: hideTop ? 0 : "auto" }}>`, and animating
 * TO "auto" is the one thing framer cannot do without measuring: it runs `measureAllKeyframes`,
 * which reads layout, and to keep that read from moving the page it saves the scroll offset and
 * calls `window.scrollTo(...)` to put it back.
 *
 * That restore lands in the middle of any smooth scroll in flight and kills it. Clicking the PDP's
 * rating pill crosses this component's 120px threshold on the way down, the collapse fires, framer
 * pins the page at ~220px, and the jump to #reviews dies there -- which is the "the sticky bar
 * eats it, I have to click twice" report. The second click starts below the threshold, so nothing
 * animates and the scroll completes. Nothing was wrong with the anchor; the header was reaching in
 * and grabbing the scroll position.
 *
 * `grid-template-rows: 1fr -> 0fr` is the native way to animate an unknown height. It is a real
 * CSS transition on the compositor, it measures nothing, it touches no scroll offset, and it took
 * framer-motion out of the header's bundle on the way past.
 */

/**
 * A block that collapses to nothing without anyone having to know how tall it is.
 *
 * The outer element is the grid and owns the transition; the inner one MUST carry `min-h-0`, or
 * its content sets a floor the 0fr track cannot go below and the whole thing simply does not move.
 */
function Collapse({ open, className, children, ...rest }) {
  return (
    <div
      {...rest}
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows,opacity] duration-[250ms] ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className={cn("min-h-0", open ? "" : "invisible")}>{children}</div>
    </div>
  );
}

export default function Header({ menuData }) {
  const [hideTop, setHideTop] = useState(false);

  // A plain listener, not framer's useScroll: the only question is whether one number is past 120,
  // and a motion value that re-renders this tree on every frame is a lot of machinery for a
  // boolean. React bails out when it is unchanged, so a scroll costs no re-render.
  useEffect(() => {
    const onScroll = () => setHideTop(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Mobile — below 1024px. Rendered server-side, hidden by CSS on desktop. */}
      <header className="sticky top-0 z-100 w-full bg-white lg:hidden">
        <TopBar />
        <MobileHeader menuData={menuData} />
      </header>

      {/* Desktop — 1024px and up. Sticky, not fixed: it takes its own height in flow, so
          the banner sits flush under the menu with no spacer to keep in sync.

          It carried a data-sticky-header hook so pages could measure this element's live bottom edge
          and dock their own pinned furniture under it -- that height is not a constant, it animates
          between ~153px and ~48px as TopBar and MainHeader collapse. Nothing measures it any more:
          the PDP's buy bar now covers this header instead of docking beneath it (user, 2026-08-15),
          so the attribute went with the measurement. Bring it back the day something needs to sit
          under the header rather than over it; ProductGallery's HEADER = 168 is the hardcoded
          version of the same number, and it has already drifted. */}
      <div className="sticky top-0 z-100 hidden lg:block">
        <header className="w-full border-b border-gray-100 bg-white">
          {/* data-collapses-on-scroll: utils/jumpTo measures these two to work out how much
              document height is about to disappear above an anchor it is scrolling to. Measured
              rather than hardcoded, so nothing drifts when the header's contents change. */}
          <Collapse open={!hideTop} data-collapses-on-scroll>
            <TopBar />
          </Collapse>

          {/* overflow-visible while open, because MainHeader's own dropdowns have to escape it. */}
          <Collapse
            open={!hideTop}
            data-collapses-on-scroll
            className={cn("relative z-20", hideTop ? "" : "overflow-visible")}
          >
            <MainHeader />
          </Collapse>

          <div className="relative z-10">
            <Navbar hideTop={hideTop} menuData={menuData} />
          </div>
        </header>
      </div>
    </>
  );
}
