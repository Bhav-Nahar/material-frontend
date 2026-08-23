import { createListenerMiddleware } from "@reduxjs/toolkit";
import { toast } from "sonner";

import { addWishlistApi, removeWishlistApi } from "@/lib/api";
import {
  addGuestWishlistItem,
  removeGuestWishlistItem,
} from "./features/wishlist/wishlistSlice";

/**
 * Mirrors a signed-in customer's wishlist into MongoDB.
 *
 * THE BUG THIS FIXES. `addGuestWishlistItem` / `removeGuestWishlistItem` are dispatched from four
 * places -- ProductCard, the PDP, the cart's "move to wishlist" and the wishlist page's remove -- and
 * every one of them was guest-only. The `addWishlistItem` / `removeWishlistItem` thunks that actually
 * write to the database existed and were called by nothing. So a signed-in customer's saves lived in
 * their browser's localStorage and nowhere else: clear the browser, or open the account on a phone,
 * and the list was gone. Nothing failed visibly, which is why it survived this long.
 *
 * WHY A LISTENER AND NOT FOUR EDITS. Same argument as gtmListener, toastListener and
 * pincodeListener, and here it is the whole point: the reason this broke is that a call site can be
 * written without knowing the server exists. A fifth one (a rail's quick-save, a "save all" on the
 * cart) would have shipped with the same hole. This is the only file that has to know.
 *
 * THE LOCAL WRITE STILL HAPPENS FIRST and is never rolled back. The reducer has already run by the
 * time this fires, so the heart fills instantly whatever the network does -- which is right: the
 * customer's own device agreeing with them is not contingent on Atlas being awake.
 *
 * BUT A FAILED WRITE IS TOLD. The backend goes out of its way not to fake a success (routes/
 * wishlist.js returns 503 on a write it could not do, with a sentence written for a shopper), and
 * swallowing that here would undo the one thing that route is careful about. A customer who is shown
 * "saved" and later finds it gone has been lied to; one who is told now can try again.
 */
export const wishlistSyncListener = createListenerMiddleware();

/**
 * The row a remove action refers to, out of the state as it was BEFORE the reducer ran.
 *
 * Exported for its test. Both arrays are searched because a signed-in customer's rows live in
 * `items` and a guest's in `guestItems`, and someone who saved as a guest and then signed in has
 * rows in both. Matched on handle first and productId second: the four call sites send
 * `{productHandle}`, but the wishlist page sends the whole row and older code sent a bare id.
 */
export const rowFor = (wishlist = {}, payload) => {
  const handle = payload?.productHandle ?? payload;
  if (!handle) return null;
  return (
    [...(wishlist.items ?? []), ...(wishlist.guestItems ?? [])].find(
      (i) => i.productHandle === handle || i.productId === handle,
    ) ?? null
  );
};

/** Guests are already persisted by redux-persist and have no server row to keep in step. */
const signedIn = (state) => Boolean(state.user?.isAuthenticated && state.user?.accessToken);

const failed = () =>
  toast.error("Couldn't save to your account. Your list is safe on this device — try again shortly.");

wishlistSyncListener.startListening({
  actionCreator: addGuestWishlistItem,
  effect: async (action, api) => {
    if (!signedIn(api.getState())) return;
    // The reducer stores the payload as-is, so this is exactly the row the browser is now showing.
    await addWishlistApi(action.payload).catch(failed);
  },
});

wishlistSyncListener.startListening({
  actionCreator: removeGuestWishlistItem,
  effect: async (action, api) => {
    if (!signedIn(api.getState())) return;

    // The remove action carries only a handle -- that is all the reducer needs to match on -- but
    // the API deletes by productId and variantId. The removed row only still exists in the state
    // BEFORE the reducer ran, which is why this middleware is prepended in store.js.
    const row = rowFor(api.getOriginalState().wishlist, action.payload);
    // Nothing found means the local copy and the server were already out of step; there is no id to
    // delete by and inventing one would delete the wrong row.
    if (!row?.productId) return;

    await removeWishlistApi(row.productId, row.variantId || "").catch(failed);
  },
});
