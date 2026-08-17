import { createListenerMiddleware } from "@reduxjs/toolkit";

import { pushAddToCart, pushRemoveFromCart, gtmItem } from "@/lib/gtm";
import { syncCart } from "./features/cart/cartSlice";

/**
 * addToCart and removeFromCart, fired from the ONE place the cart can actually change.
 *
 * WHY NOT AT THE CALL SITES. The jewelry build pushes `addToCart` from inside the PDP's own
 * handler, which means every future place that can add a line -- a rail's quick-add, a
 * reorder button, a saved-cart restore -- silently reports nothing until somebody remembers.
 * `syncCart` is the only thunk that writes this cart, so a listener on its fulfilment cannot be
 * bypassed by a new caller and cannot double-fire when an existing one is refactored.
 *
 * The thunk argument says what was MEANT (`add` / `update`), the fulfilled payload says what the
 * cart now IS, and `getOriginalState()` says what it was a moment ago -- which is the only place
 * a removed line still exists to be described. All three are needed:
 *
 *   {add}                  new line, or more of an existing one. Quantity is what was requested,
 *                          not the line's new total -- adding 3 boxes to a line of 2 is an
 *                          addToCart of 3.
 *   {update, quantity: 0}  removal. Read off the OLD state; the new payload no longer has it.
 *   {update, quantity: n}  the cart page's stepper. Up is an add of the difference, down is a
 *                          remove of the difference -- a customer going 5 boxes to 2 has removed
 *                          3, and reporting that as nothing at all is how a cart looks like it
 *                          never lost anything.
 *
 * A bare syncCart() is a READ -- the header, the shipping page and the payment page all fire one
 * on mount -- and pushes nothing. viewCart is a separate event fired by the cart page itself,
 * because "the cart was fetched" and "the customer is looking at the cart" are not the same thing.
 */
export const gtmListener = createListenerMiddleware();

/** The line in `items` that this variant sits on, or undefined. */
const lineFor = (items, variantId) => (items ?? []).find((i) => i.variantId === variantId);

gtmListener.startListening({
  actionCreator: syncCart.fulfilled,
  effect: (action, api) => {
    const { add, update } = action.meta.arg ?? {};
    const before = api.getOriginalState().cart?.items ?? [];
    const after = action.payload?.items ?? [];

    if (add?.variantId) {
      const line = lineFor(after, add.variantId);
      if (!line) return; // Shopify accepted the mutation but sold out the line; nothing was added.
      pushAddToCart({ products: gtmItem({ ...line, quantity: Number(add.quantity ?? 1) }) });
      return;
    }

    if (update?.lineId !== undefined) {
      const was = before.find((i) => i.lineId === update.lineId);
      if (!was) return;
      const now = after.find((i) => i.lineId === update.lineId);
      // A removed line has no `now`, so its new quantity is 0.
      const delta = Number(now?.quantity ?? 0) - Number(was.quantity ?? 0);
      if (delta === 0) return;
      if (delta > 0) pushAddToCart({ products: gtmItem({ ...was, quantity: delta }) });
      else pushRemoveFromCart(gtmItem({ ...was, quantity: -delta }));
    }
  },
});
