"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

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
 * The scroll-collapse behaviour is kept as-is.
 */
export default function Header({ menuData }) {
  const [hideTop, setHideTop] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setHideTop(y > 120);
  });

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
          <motion.div
            animate={{ height: hideTop ? 0 : "auto", opacity: hideTop ? 0 : 1 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <TopBar />
          </motion.div>

          <motion.div
            animate={{
              height: hideTop ? 0 : "auto",
              opacity: hideTop ? 0 : 1,
              visibility: hideTop ? "hidden" : "visible",
            }}
            transition={{ duration: 0.25 }}
            className={cn("relative z-20", hideTop ? "overflow-hidden" : "overflow-visible")}
          >
            <MainHeader />
          </motion.div>

          <div className="relative z-10">
            <Navbar hideTop={hideTop} menuData={menuData} />
          </div>
        </header>
      </div>
    </>
  );
}
