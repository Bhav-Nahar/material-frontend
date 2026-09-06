"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The collapsed site header, plus a gutter.
 *
 * 48px is what the desktop header measures once TopBar and MainHeader are collapsed, and by the
 * time anything here is pinned the header IS collapsed -- the two thresholds in headerCollapse mean
 * it stays that way until the shopper is back at the very top. This was 168 in ProductGallery,
 * measured against the header's EXPANDED height, which is the drift Header.jsx warns about: it left
 * 104px of blank paper above a pinned column.
 */
export const STICKY_TOP = 64;

/**
 * Pin a column beside a taller one, whichever way round the two turn out to be.
 *
 * The jewelry build's trick, in a hook so both PDP columns can share it: an element TALLER than the
 * viewport gets a NEGATIVE offset, so it keeps scrolling until its last row sits against the bottom
 * of the screen and only then pins. One that fits just pins under the header.
 *
 * Give it to BOTH columns and "whichever is shorter sticks" falls out with nothing measuring which
 * is shorter: the column that fits the viewport pins immediately and rides down the page, while the
 * one that does not scrolls through to its end first. Swap their heights -- a two-photo gallery
 * against a long buy box -- and the behaviour swaps with them, because the rule is about fitting the
 * viewport, not about which column is which.
 *
 * `fit` is never called from the effect body: ResizeObserver fires once on observe, which covers the
 * first measurement without a synchronous setState in the effect.
 */
export function useStickyFit() {
  const ref = useRef(null);
  const [top, setTop] = useState(STICKY_TOP);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () =>
      setTop(Math.min(STICKY_TOP, window.innerHeight - el.offsetHeight - 24));

    const observer = new ResizeObserver(fit);
    observer.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return [ref, top];
}
