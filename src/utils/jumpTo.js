/**
 * Scroll to an in-page anchor, once, landing in the right place.
 *
 * WHY THIS EXISTS AT ALL. `<a href="#reviews">` on its own works exactly once. The App Router
 * intercepts the click and turns it into a router push; pushing a URL that already ends in
 * `#reviews` is a no-op to the router but still cancels the browser's native fragment scroll, so
 * the second and every later click lands short. A shopper who reads the reviews, scrolls back up
 * and taps the rating again gets a page that twitches and stays put.
 *
 * WHY IT DOES THE ARITHMETIC INSTEAD OF CALLING scrollIntoView. The desktop header collapses on the
 * way down (Header.jsx, past 120px) and it is `sticky` -- in flow -- so it takes ~105px of its own
 * height OUT of the document above the target. scrollIntoView aims at where the section is when the
 * click happens; by the time the page arrives the section has moved up by that much, and it
 * overshoots. Correcting afterwards works but you can SEE it: the page glides down, stops, and
 * hops back. Two movements for one tap.
 *
 * So compute where the section will BE, and go there in one move. A browser's smooth scroll targets
 * a scroll offset -- a number -- not an element, so layout shifting underneath mid-flight cannot
 * pull the destination around. Get the number right and the landing is right.
 *
 * 'smooth' only when the OS allows motion: a long smooth scroll is exactly the movement that
 * triggers motion sickness, and for someone who asked for none the instant jump is correct. (This
 * used to defer to a global `scroll-behavior: smooth` in globals.css; that rule is gone because it
 * also animated the browser's scroll restoration on back/forward.)
 *
 * BUT NOT OVER ANY DISTANCE (user, 2026-09-05: the jump to the reviews "is not a smooth flow").
 * The landing was never wrong -- measured, it puts the section exactly on its scroll-margin -- the
 * trip was. #reviews sits ~2700px down a PDP now that the mosaic shows every photograph, and a
 * native smooth scroll over that is a second and a half of blur during which the browser is also
 * decoding eight full-width tiles that the flight path drags through the viewport. The animation
 * stopped being orientation and became waiting.
 *
 * A screen or two is the range where gliding tells you WHERE you went, which is the point of
 * gliding at all. Past that nobody is tracking scenery, so go straight there.
 *
 * The href stays on the element: it is what makes the link real -- open in a new tab, copy link
 * address, and a working jump with JavaScript off. This only takes over when it can do the job, so
 * a missing target falls through to the browser rather than swallowing the click.
 *
 * replaceState, not pushState: the address bar should say #reviews, but ten taps on the rating
 * should not cost ten presses of the back button to leave the page.
 */

/** Matches COLLAPSE_ABOVE in lib/headerCollapse. Below this the header is open; above it, collapsed. */
const HEADER_COLLAPSE_AT = 120;

/** How far a glide stays useful, in viewport heights. Past this the jump is instant. */
const SMOOTH_WITHIN_SCREENS = 2;

/**
 * How much document height the header is about to give back.
 *
 * Measured, not hardcoded -- the collapsing strip is a TopBar and a MainHeader whose height depends
 * on what is in them. Both live inside the desktop-only `hidden lg:block` wrapper, so on a phone
 * they measure 0 and the whole adjustment disappears on its own, which is correct: the mobile
 * header does not collapse.
 */
const pendingHeaderCollapse = () => {
  let height = 0;
  for (const el of document.querySelectorAll("[data-collapses-on-scroll]")) {
    height += el.getBoundingClientRect().height;
  }
  return height;
};

export const jumpTo = (id) => (event) => {
  const el = document.getElementById(id);
  if (!el) return; // nothing to scroll to -- let the href do whatever it would have done

  event.preventDefault();

  const from = window.scrollY;
  const marginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  // Where the section sits in the document right now, less the clearance it asks for.
  let target = el.getBoundingClientRect().top + from - marginTop;

  // Crossing the threshold on this trip is what shrinks the header, and only then does the target
  // move. Already past it (header collapsed) or not going past it: nothing to subtract.
  if (from <= HEADER_COLLAPSE_AT && target > HEADER_COLLAPSE_AT) {
    target -= pendingHeaderCollapse();
  }

  const top = Math.max(0, Math.round(target));

  /*
   * SCROLL ANCHORING HAS TO BE HELD OFF for the length of the collapse, or the correction above is
   * spent twice and the landing is 105px out.
   *
   * Chrome and Firefox watch the document shrink above the viewport and move scrollY to keep the
   * content visually still. That is the right instinct everywhere else on this site -- it is what
   * makes the header collapse look like nothing happened -- but here we have ALREADY accounted for
   * that shrink, so the browser's help lands us short. A smooth scroll used to hide this by
   * out-running it: the animation keeps driving toward a fixed offset whatever anchoring does. An
   * instant scroll arrives first and gets dragged afterwards, measured at exactly the 105px the
   * collapse removes.
   *
   * Safari implements no scroll anchoring at all, so it always needed the correction as written.
   * Turning anchoring off for the trip makes every browser behave the way Safari already did, and
   * the arithmetic have one answer instead of two.
   */
  const root = document.documentElement;
  const anchoring = root.style.overflowAnchor;
  root.style.overflowAnchor = "none";
  // Comfortably past the 250ms collapse in Header.jsx; restoring early is what re-opens the drift.
  setTimeout(() => {
    root.style.overflowAnchor = anchoring;
  }, 400);

  window.scrollTo({
    top,
    behavior:
      Math.abs(top - from) > window.innerHeight * SMOOTH_WITHIN_SCREENS ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
  });
  history.replaceState(null, "", `#${id}`);
};
