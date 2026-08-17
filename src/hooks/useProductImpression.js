"use client";

import { useEffect, useRef } from "react";

import { gtmItem, pushProductImpression } from "@/lib/gtm";

/**
 * productImpression, for the products a customer has ACTUALLY SEEN.
 *
 * The jewelry build fires one impression event for every product in the listing the moment the data
 * lands -- 48 items on the first page, another 48 on each infinite-scroll fetch, all of them
 * reported as viewed while 44 of them are still a thousand pixels below the fold. Every
 * view-to-click rate computed off that is wrong, and wrong in the direction that makes a bad
 * listing look like a bad product.
 *
 * So: an IntersectionObserver per card, one shared instance, and a card counts as seen when half
 * of it is in the viewport. Scrolling down fires the next batch as the next row arrives.
 *
 * BATCHED, not one event per card. A grid row entering the viewport is four cards crossing the
 * threshold within a frame of each other; without the flush timer that is four dataLayer pushes
 * and four tag fires for one scroll. The queue drains 400ms after the last card arrives, so a
 * continuous scroll reports whole rows and a fast flick reports one event, not thirty.
 *
 * ponytail: threshold only, no dwell timer -- half the card in view is the signal, and a "must
 * remain visible for 1s" rule needs a per-card timer plus cancellation on the way out for an event
 * nobody is measuring engagement time from. Add the timer if impressions ever need to mean
 * attention rather than exposure.
 */

const FLUSH_MS = 400;
const VISIBLE_RATIO = 0.5;

/** handle -> the pending item, so a card re-crossing the threshold cannot queue twice. */
const queue = new Map();
/** Everything already reported for the current page. Cleared on navigation, below. */
const seen = new Set();
let flushTimer = null;
let observer = null;
let lastPath = "";

/** The DOM node a card registered with, and the payload to send when it is seen. */
const registry = new WeakMap();

const flush = () => {
  flushTimer = null;
  if (queue.size === 0) return;
  const batch = [...queue.values()];
  queue.clear();
  // One list name per batch: cards from two different lists cannot be in one batch, because a
  // rail and a grid are never both crossing the threshold in the same 400ms window on any layout
  // this store has. If that ever stops being true, group by listName here.
  pushProductImpression(
    batch.map((entry, i) => gtmItem(entry.product, i)),
    batch[0].listName,
  );
};

const getObserver = () => {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = registry.get(entry.target);
        if (!item) continue;

        // A card is reported once per LIST per page. The same product in a grid and in the
        // "recently viewed" rail below it are two impressions, which is what they are.
        const key = `${item.listName}:${item.product?.handle}`;
        if (seen.has(key)) {
          observer.unobserve(entry.target);
          continue;
        }
        seen.add(key);
        queue.set(key, item);
        // Nothing more to learn from this node; a card cannot be impressed twice.
        observer.unobserve(entry.target);
      }

      if (queue.size > 0 && flushTimer === null) {
        flushTimer = setTimeout(flush, FLUSH_MS);
      }
    },
    { threshold: VISIBLE_RATIO },
  );
  return observer;
};

/**
 * Attach the returned ref to a card's root element.
 *
 * @param {object} product a card product -- whatever mapProducts / toCardProduct returns
 * @param {string} listName which listing this card is in, e.g. "collection:subway-tiles"
 * @returns {import("react").RefObject} ref for the card's outermost node
 */
export function useProductImpression(product, listName = "") {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !product?.handle) return;

    // A new page is a new set of impressions. Same product, same list, different visit -- and
    // without this reset a customer returning to a collection reports nothing at all.
    const path = `${window.location.pathname}${window.location.search}`;
    if (path !== lastPath) {
      lastPath = path;
      seen.clear();
      queue.clear();
    }

    registry.set(node, { product, listName });
    const io = getObserver();
    io.observe(node);
    return () => io.unobserve(node);
  }, [product, listName]);

  return ref;
}
