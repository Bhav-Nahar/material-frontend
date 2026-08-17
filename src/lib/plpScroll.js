/**
 * Coming back to a listing page.
 *
 * A shopper who scrolls six pages deep, opens a product and hits back gets a page that has
 * forgotten all of it: `loaded` starts empty on every mount, so the grid is the server's first page
 * again. The document is a fraction of its old height, the browser clamps the old offset to the
 * bottom of it, and they land in the footer with no idea where their tile went.
 *
 * So: remember which card was opened and how many pages were behind it, replay those pages on the
 * way back, and scroll to the CARD rather than to a pixel offset -- lazy images and a tag chip
 * appearing are enough to make a saved offset point at the wrong row.
 *
 * Everything is keyed by the full URL, path and query both, so the same collection under two
 * different filter sets keeps two different positions and two open tabs do not overwrite each other.
 */

/** How long a saved position is worth restoring. A next-day visit should feel like a fresh page. */
const TTL = 30 * 60 * 1000;

/**
 * Ceiling on replayed pages. Each is a cursor fetch and they cannot be parallelised -- the next
 * cursor only exists once the previous page lands -- so without a cap someone twenty pages deep
 * waits out twenty round trips. The replay also stops early the moment the opened card turns up,
 * so this only bites when the card is very deep or has since dropped out of the collection.
 */
export const MAX_RESTORE_PAGES = 8;

const stateKey = (url) => `plp:${url}:state`;
const productKey = (url) => `plp:${url}:product`;

export function plpUrlKey() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

export function readPlpState(url) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(stateKey(url));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (typeof saved.savedAt !== "number" || Date.now() - saved.savedAt > TTL) return null;
    return saved;
  } catch {
    // Private mode, or storage full. Not being able to restore is not worth an error.
    return null;
  }
}

export function savePlpState(url, { scrollY, pages }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(stateKey(url), JSON.stringify({ scrollY, pages, savedAt: Date.now() }));
  } catch {
    // as above
  }
}

/** Called by the card on click, against whatever page it is currently sitting on. */
export function rememberProduct(handle) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(productKey(plpUrlKey()), handle);
  } catch {
    // as above
  }
}

export function readRememberedProduct(url) {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(productKey(url));
  } catch {
    return null;
  }
}

function forgetProduct(url) {
  try {
    window.sessionStorage.removeItem(productKey(url));
  } catch {
    // as above
  }
}

/**
 * Put the opened card back under the shopper's eyes.
 *
 * Retried across animation frames because the cards we just replayed are not in the DOM yet on the
 * frame we ask -- React has to commit them and the images have to reserve their aspect boxes first.
 * Eight frames is roughly 130ms of budget, which covers a slow phone without the page visibly
 * hunting around.
 *
 * When it does run out: scroll to the top of the grid. Doing nothing is the harmful option -- that
 * leaves the browser's own clamp in charge, and the clamp is the footer. A predictable place beats
 * a baffling one.
 */
export function restoreListingScroll({ url, productHandle, scrollY, gridEl }) {
  let attempts = 0;

  const tryOnce = () => {
    if (productHandle) {
      const el = document.querySelector(`[data-plp-handle="${CSS.escape(productHandle)}"]`);
      if (!el) return false;
      // Leave the card a little below the top edge rather than flush against the sticky header.
      const y = el.getBoundingClientRect().top + window.scrollY - Math.max(80, window.innerHeight * 0.15);
      window.scrollTo(0, Math.max(0, y));
      forgetProduct(url);
      return true;
    }
    if (scrollY > 0) {
      window.scrollTo(0, scrollY);
      return true;
    }
    return false;
  };

  const kick = () => {
    if (tryOnce()) return;
    if (++attempts < 8) {
      requestAnimationFrame(kick);
      return;
    }
    forgetProduct(url);
    if (!gridEl) return;
    const top = Math.max(0, gridEl.getBoundingClientRect().top + window.scrollY - 80);
    // Anyone already at or above the grid is left alone, so this can never scroll a page DOWN.
    if (window.scrollY > top) window.scrollTo(0, top);
  };

  requestAnimationFrame(() => requestAnimationFrame(kick));
}
