import { createListenerMiddleware } from "@reduxjs/toolkit";

import { fetchCustomerPincode, saveCustomerPincode } from "@/lib/api";
import { checkPincode } from "@/lib/delivery";
import { login, setPincode } from "./features/user/userSlice";

/**
 * Keeps the pincode in three places agreeing: the Redux store, localStorage (redux-persist already
 * does that one) and `custom.pincode` on the Shopify customer.
 *
 * WHY A LISTENER, again -- same argument as gtmListener and toastListener. The pincode is set from
 * the header control, the PDP's PincodeCheck, the buy sheet and (eventually) the checkout's shipping
 * step; a save written at each of those is a save the fifth one forgets. This is the only place that
 * has to know the metafield exists.
 *
 * THE METAFIELD IS A BACKUP, NOT THE SOURCE. Redux + localStorage answer instantly and work for the
 * signed-out majority; the metafield exists so the answer survives a cleared browser and follows the
 * account from a phone to a laptop. So nothing here ever blocks or reverts local state: a failed
 * write is swallowed, and the customer keeps the pincode they just typed.
 *
 * ON LOGIN, LOCAL WINS. Someone who typed 400705 ten seconds ago and then signed in meant 400705,
 * not whatever they saved from another device in March. The metafield is only read when there is no
 * local pincode to prefer -- which is exactly the cleared-browser and new-device case it is for.
 */
export const pincodeListener = createListenerMiddleware();

/** Anything short of a full valid pincode is a half-typed one; it is not worth a request. */
const complete = (pincode) => checkPincode(pincode).status !== "invalid";

pincodeListener.startListening({
  actionCreator: setPincode,
  effect: async (action, api) => {
    const { accessToken, isAuthenticated, pincode } = api.getState().user;
    if (!isAuthenticated || !accessToken) return; // guests keep it in localStorage and nothing else
    if (!complete(pincode)) return;

    // Typing lands six setPincode actions in about a second. cancelActiveListeners() drops the
    // in-flight ones so only the last digit's write survives -- the alternative is six PUTs racing
    // to set the same metafield, and the one that lands last is not necessarily the one they meant.
    api.cancelActiveListeners();
    await api.delay(400);

    await saveCustomerPincode(pincode, accessToken).catch(() => null);
  },
});

pincodeListener.startListening({
  actionCreator: login,
  effect: async (action, api) => {
    const { accessToken, pincode } = api.getState().user;
    if (!accessToken) return;

    // A pincode typed as a guest is the fresher answer, so it goes UP.
    if (complete(pincode)) {
      await saveCustomerPincode(pincode, accessToken).catch(() => null);
      return;
    }

    // Nothing local: this is the cleared-browser / new-device case the metafield exists for.
    const saved = await fetchCustomerPincode(accessToken).catch(() => null);
    // ponytail: this dispatch re-enters the listener above and writes the same value straight back.
    // One redundant idempotent PUT on a cold login is cheaper than a "do not echo this" flag on the
    // action, which every future caller of setPincode would then have to know about.
    if (saved?.pincode) api.dispatch(setPincode(saved.pincode));
  },
});
