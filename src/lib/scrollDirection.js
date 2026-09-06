/**
 * Should the back-to-top button be on screen?
 *
 * IT FOLLOWS THE DIRECTION, not the depth (user, 2026-09-05). A button that simply appears past
 * some offset is on screen for the whole page, covering content on the way DOWN -- which is the
 * half of the journey where nobody wants it. Scrolling up IS the gesture that means "I have gone
 * too far", so the button answers a question the shopper has already asked instead of sitting there
 * asking it for them.
 *
 * THE DEAD ZONE IS THE WHOLE TRICK. Momentum scrolling on a trackpad and the rubber-band at the end
 * of a page both produce a frame or two of negative delta inside a downward scroll; comparing
 * against the immediately previous position makes the button strobe on every one of them. So `last`
 * is not "where we were last frame", it is the last position that COMMITTED to a direction -- a
 * movement smaller than the threshold changes nothing and is not recorded, which lets a slow drag
 * accumulate until it means something rather than being averaged away.
 *
 * BELOW ONE SCREEN it stays hidden whichever way we are going: there is nothing to go back to, and
 * the top of the page is already a flick away.
 */

/** Pixels of travel before a wobble counts as a direction. */
export const DEAD_ZONE = 6;

/**
 * @param {{y: number, last: number, shown: boolean, viewportH: number}} state
 * @returns {{shown: boolean, last: number}} the next state -- `last` only moves when direction did
 */
export function nextScrollState({ y, last, shown, viewportH }) {
  if (y <= viewportH) return { shown: false, last: y };

  const delta = y - last;
  if (Math.abs(delta) < DEAD_ZONE) return { shown, last };

  return { shown: delta < 0, last: y };
}
