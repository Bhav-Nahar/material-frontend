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
 * NO `behavior` ARGUMENT, on purpose. The default 'auto' means "use the computed scroll-behavior",
 * which is the `scroll-behavior: smooth` in globals.css -- and that rule is already behind
 * prefers-reduced-motion. Passing 'smooth' here would force the animation on someone who asked
 * their OS for none.
 *
 * The href stays on the element: it is what makes the link real -- open in a new tab, copy link
 * address, and a working jump with JavaScript off. This only takes over when it can do the job, so
 * a missing target falls through to the browser rather than swallowing the click.
 *
 * replaceState, not pushState: the address bar should say #reviews, but ten taps on the rating
 * should not cost ten presses of the back button to leave the page.
 */

/** Matches the threshold in Header.jsx. Below this the header is open; above it, collapsed. */
const HEADER_COLLAPSE_AT = 120;

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

  window.scrollTo({ top: Math.max(0, Math.round(target)) });
  history.replaceState(null, "", `#${id}`);
};
