import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import { rootPersistConfig } from "./persist";
import createWebStorage from "redux-persist/lib/storage/createWebStorage";

import { gtmListener } from "./gtmListener";
import { toastListener } from "./toastListener";
import { pincodeListener } from "./pincodeListener";
import { wishlistSyncListener } from "./wishlistSyncListener";
import userReducer from "./features/user/userSlice";
import cartReducer from "./features/cart/cartSlice";
import wishlistReducer from "./features/wishlist/wishlistSlice";
import recentlyViewedReducer from "./features/recentlyViewed/recentlyViewedSlice";

const createNoopStorage = () => {
  return {
    getItem(_key) {
      return Promise.resolve(null);
    },
    setItem(_key, value) {
      return Promise.resolve(value);
    },
    removeItem(_key) {
      return Promise.resolve();
    },
  };
};

const storage = typeof window !== "undefined" ? createWebStorage("local") : createNoopStorage();

const cartPersistConfig = {
  key: "cart",
  storage,
  blacklist: ["loading", "error"],
};

const wishlistPersistConfig = {
  key: "wishlist",
  storage,
  blacklist: ["loading", "error"],
};

// Whether a modal is open is not state worth surviving a page load. Persisting it means a customer
// who closed the tab mid-signin gets the dialog thrown back at them on arrival -- and on /login it
// renders the sign-in form twice, once in the page and once in the overlay on top of it.
const userPersistConfig = {
  key: "user",
  storage,
  blacklist: ["isAuthModalOpen", "authRedirectPath", "authMode", "authSource", "referralLoading", "referralError"],
};

const rootReducer = combineReducers({
  user: persistReducer(userPersistConfig, userReducer),
  cart: persistReducer(cartPersistConfig, cartReducer),
  wishlist: persistReducer(wishlistPersistConfig, wishlistReducer),
  recentlyViewed: recentlyViewedReducer,
});

const persistedReducer = persistReducer(
  {
    ...rootPersistConfig,
    // user is nested-persisted above (userPersistConfig) so modal state stays out; listing it here
    // too would persist the whole slice again and undo that.
    whitelist: ["recentlyViewed"],
  },
  rootReducer
);

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== "production",
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      // PREPENDED, so it sees the action before anything else can swallow it, and so
      // getOriginalState() is genuinely the state before the cart reducer ran -- which is the only
      // place a line removed by this action still exists to be reported. See gtmListener.js.
      // toastListener is prepended alongside it for the same getOriginalState() reason: a removed
      // cart line only still exists in the state BEFORE the reducer ran.
    }).prepend(
      gtmListener.middleware,
      toastListener.middleware,
      pincodeListener.middleware,
      // Prepended for the same reason: the removed wishlist row only still exists in the state
      // before the reducer ran, and that row carries the productId the DELETE needs.
      wishlistSyncListener.middleware,
    ),
});

export const persistor = persistStore(store);
