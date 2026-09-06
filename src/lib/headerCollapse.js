/**
 * When the desktop header shows its full stack, and when it is down to the Navbar strip.
 *
 * TWO thresholds, not one, and the distance between them is the whole point.
 *
 * The header is `position: sticky`, so it TAKES ITS HEIGHT IN FLOW -- collapsing it removes
 * TopBar (40px) + MainHeader (65px) from the document above the viewport, and Chrome's scroll
 * anchoring then moves `scrollY` by that much to keep the content the reader is looking at
 * visually still. So the header's own resize SHOVES THE VERY NUMBER that decides whether it
 * should be resized.
 *
 * With a single threshold that is a feedback loop, not a hysteresis gap: park anywhere in roughly
 * 15..120, the header expands, anchoring bumps scrollY past 120, it collapses, anchoring drops
 * scrollY back under 120, it expands. Measured at ~8 frames per cycle and it never settles -- the
 * menu, the collapsed strip and the buy bar all strobing in the same band (user, 2026-09-05).
 *
 * THE INVARIANT, which headerCollapse.test.mjs enforces: COLLAPSE_ABOVE - EXPAND_AT_OR_BELOW must
 * stay greater than COLLAPSE_DELTA. Anchoring can move scrollY by at most COLLAPSE_DELTA when the
 * state flips, so a gap wider than that cannot land on the far side of the other threshold, and
 * the machine reaches a fixed point after one flip. Narrow the gap below 105 and the strobe is
 * back -- which is why re-expanding waits for the very top rather than some comfortable-looking
 * 60px.
 */
export const COLLAPSE_ABOVE = 120;
export const EXPAND_AT_OR_BELOW = 0;

/** TopBar + MainHeader: the document height the collapse adds or removes above the viewport. */
export const COLLAPSE_DELTA = 105;

/** The header's next state, given the one it is in. Hysteresis: the threshold it is measured
 *  against depends on which state it is already in. */
export function nextHideTop(wasHidden, scrollY) {
  return scrollY > (wasHidden ? EXPAND_AT_OR_BELOW : COLLAPSE_ABOVE);
}
