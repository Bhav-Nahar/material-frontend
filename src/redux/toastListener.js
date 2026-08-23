import { createListenerMiddleware } from "@reduxjs/toolkit";
import { toast } from "sonner";

import { syncCart } from "./features/cart/cartSlice";
import {
  addGuestWishlistItem,
  removeGuestWishlistItem,
} from "./features/wishlist/wishlistSlice";

/**
 * "Added to cart", "Saved", "Removed" -- fired from the ONE place each of those things can happen,
 * for exactly the reason gtmListener.js gives: the cart is added to from the PDP, the cart page's
 * stepper and (soon) a rail's quick-add, and a toast written at each call site is a toast that the
 * fourth call site forgets. A listener on the thunk cannot be bypassed by a new caller.
 *
 * WHY A TOAST AT ALL, when Newsletter and ReviewForm deliberately refuse one. Those report the
 * outcome of a FORM the customer is looking at -- the answer belongs in the form, where it stays put
 * and can be read twice. These report a change that happens somewhere else: the only visible effect
 * of tapping a heart or an Add button is a digit in the header, 700px away and 12px tall, which on a
 * phone is off-screen entirely. The toast is not decoration here, it is the only confirmation.
 *
 * ONE LINE OF TEXT, and nothing else. This carried a product thumbnail, a status badge, an accent
 * bar and an Undo button for about ten minutes (user, 2026-08-22: "the UI is too much"). CaratLane
 * is right and that was wrong: the toast is read in the half-second before the eye goes back to the
 * grid, and everything past the sentence is furniture that has to be looked past. Anything that
 * genuinely needs a thumbnail or an Undo needs a surface that stays on screen -- the cart page has
 * both.
 *
 * NO TOAST ON FAILURE. Every one of these paths already prints its own error where the customer is
 * looking -- an out-of-stock line on the PDP button, a red line under the form -- and a floating
 * "something went wrong" that vanishes in three seconds is the worst place to put the one message
 * they need to act on.
 */
export const toastListener = createListenerMiddleware();

/** The line in `items` that this variant sits on, or undefined. */
const lineFor = (items, variantId) => (items ?? []).find((i) => i.variantId === variantId);

toastListener.startListening({
  actionCreator: syncCart.fulfilled,
  effect: (action, api) => {
    const { add, update } = action.meta.arg ?? {};

    if (add?.variantId) {
      // Shopify can accept the mutation and still not seat the line (sold out between render and
      // click). No line, no "added to cart" -- the PDP shows the real reason.
      if (!lineFor(action.payload?.items, add.variantId)) return;
      // `info`, not `success`: the type here only picks the colour (see the Toaster in layout.js),
      // and the cart is the orange one.
      toast.info("Added to cart");
      return;
    }

    // The cart page's stepper, and its remove button. A bare syncCart() is a READ -- the header and
    // both checkout steps fire one on mount -- and must stay silent, which the `update` guard does.
    if (update?.lineId !== undefined) {
      const before = api.getOriginalState().cart?.items ?? [];
      const was = before.find((i) => i.lineId === update.lineId);
      if (!was) return;
      const now = (action.payload?.items ?? []).find((i) => i.lineId === update.lineId);
      const delta = Number(now?.quantity ?? 0) - Number(was.quantity ?? 0);
      if (delta === 0) return;
      // Only the REMOVAL is announced. A stepper is its own confirmation -- the number the customer
      // pressed towards is right there under their thumb -- but a removed row leaves nothing behind
      // to look at, which is exactly when someone wonders whether they hit the wrong one.
      if (delta < 0 && !now) toast("Removed from cart");
    }
  },
});

/**
 * ONE ACTION PER EVENT, guest or signed in. These two are dispatched by every call site and the
 * server mirror hangs off them (wishlistSyncListener), so they are the single source of "the
 * customer saved something". This used to also match addWishlistItem.fulfilled, which now means a
 * second toast for the same tap.
 */
toastListener.startListening({
  actionCreator: addGuestWishlistItem,
  effect: () => toast.success("Added to wishlist"),
});

toastListener.startListening({
  actionCreator: removeGuestWishlistItem,
  effect: () => toast("Removed from wishlist"),
});
