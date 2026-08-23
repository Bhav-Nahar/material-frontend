import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchWishlistApi, addWishlistApi, removeWishlistApi, syncWishlistApi } from "@/lib/api";
import { logout } from "../user/userSlice";

const getNumericId = (gid) => {
  if (!gid) return 0;
  if (typeof gid === "number") return gid;
  const match = String(gid).match(/\d+$/);
  return match ? String(match[0]) : String(gid);
};

export const fetchWishlist = createAsyncThunk(
  "wishlist/fetchWishlist",
  async (_, { dispatch, getState }) => {
    try {
      const { user } = getState().user;
      const { sessionId } = getState().cart; // Assuming sessionId is stored in cart or global state
      const data = await fetchWishlistApi(user?.id, sessionId);
      return data.items || [];
    } catch (err) {
      console.error("Wishlist operation failed:", err);
      throw err;
    }
  }
);

export const addWishlistItem = createAsyncThunk(
  "wishlist/addWishlistItem",
  async (payload, { dispatch, getState }) => {
    try {
      const { user } = getState().user;
      const { sessionId } = getState().cart;
      const data = await addWishlistApi(payload, user?.id, sessionId);
      return data.item;
    } catch (err) {
      console.error("Wishlist operation failed:", err);
      throw err;
    }
  }
);

export const removeWishlistItem = createAsyncThunk(
  "wishlist/removeWishlistItem",
  async (payload, { dispatch, getState }) => {
    const productId = typeof payload === 'string' ? payload : payload.productId;
    const variantId = typeof payload === 'string' ? "" : payload.variantId;
    try {
      const { user } = getState().user;
      const { sessionId } = getState().cart;
      await removeWishlistApi(productId, variantId, user?.id, sessionId);
      return payload;
    } catch (err) {
      console.error("Wishlist operation failed:", err);
      throw err;
    }
  }
);

export const mergeGuestWishlist = createAsyncThunk(
  "wishlist/mergeGuestWishlist",
  async (_, { getState }) => {
    const { user } = getState().user;
    const { sessionId } = getState().cart;
    const { wishlist } = getState();
    
    const guestItems = wishlist.guestItems || [];
    const fetched = await fetchWishlistApi(user?.id, sessionId);
    const remoteItems = fetched.items || [];

    if (!guestItems.length) {
      return remoteItems;
    }

    const remoteUniqueKeys = new Set(remoteItems.map((item) => `${getNumericId(item.productId)}-${getNumericId(item.variantId || "")}`));
    const itemsToAdd = guestItems.filter((item) => !remoteUniqueKeys.has(`${getNumericId(item.productId)}-${getNumericId(item.variantId || "")}`));

    if (itemsToAdd.length > 0) {
        const mergedItems = [...remoteItems, ...itemsToAdd];
        await syncWishlistApi(mergedItems, user?.id, sessionId);
        return mergedItems;
    }

    return remoteItems;
  }
);

const initialState = {
  items: [],
  guestItems: [],
  loading: false,
  error: null,
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    clearWishlist: (state) => {
      state.items = [];
      state.loading = false;
      state.error = null;
    },
    addGuestWishlistItem: (state, action) => {
      const item = action.payload;
      // MATCH ON HANDLE FIRST -- same rule as removeGuestWishlistItem below, for the same reason:
      // getNumericId takes the trailing digits, so the handles "carrara-matte-600" and
      // "travertine-beige-600" both collapse to "600" and the second add was silently dropped as a
      // duplicate of the first. Only gid-shaped ids go through getNumericId.
      const sameProduct = (a, b) =>
        a.productHandle && b.productHandle
          ? a.productHandle === b.productHandle
          : `${getNumericId(a.productId)}-${getNumericId(a.variantId || "")}` ===
            `${getNumericId(b.productId)}-${getNumericId(b.variantId || "")}`;

      if (!state.guestItems.some((i) => sameProduct(i, item))) state.guestItems.unshift(item);
      if (!state.items.some((i) => sameProduct(i, item))) state.items.unshift(item);
    },
    removeGuestWishlistItem: (state, action) => {
      const payload = action.payload;
      const isString = typeof payload === 'string';
      // MATCH ON HANDLE FIRST. ProductCard and the PDP both save catalogue items keyed by handle and
      // send `{ productHandle }` to remove them -- this reducer only read `payload.productId`, so the
      // removal silently matched nothing and the heart could be turned on but never off.
      //
      // Handle also has to be compared as a STRING, not through getNumericId: that helper takes the
      // trailing digits of an id, so "glass-mosaic-sheet-sea-green-300" collapses to "300", which
      // both fails to match the stored handle and would collide with any other product ending in the
      // same number. It is right for a Shopify gid, wrong for a handle.
      const handle = !isString ? payload.productHandle : null;
      const productId = getNumericId(isString ? payload : payload.productId);
      const variantId = getNumericId(isString ? "" : payload.variantId);

      const filterFn = (item) => {
        if (handle) return item.productHandle !== handle;

        const itemProdId = getNumericId(item.productId);
        const itemVarId = getNumericId(item.variantId || "");

        if (variantId && variantId !== "0") {
          return !(itemProdId === productId && itemVarId === variantId);
        }
        return itemProdId !== productId;
      };

      state.guestItems = state.guestItems.filter(filterFn);
      state.items = state.items.filter(filterFn);
    },
    restoreGuestWishlist: (state) => {
      state.items = state.guestItems;
      state.loading = false;
      state.error = null;
    },
    clearGuestWishlist: (state) => {
      state.guestItems = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase("user/logout", (state) => {
        state.items = state.guestItems; // Revert to guest state
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(addWishlistItem.pending, (state, action) => {
        state.loading = true;
        // Optimistic add
        const item = action.meta.arg;
        if (item && item.productId) {
          const prodId = getNumericId(item.productId);
          const varId = getNumericId(item.variantId || "");
          const key = `${prodId}-${varId}`;
          if (!state.items.find((i) => `${getNumericId(i.productId)}-${getNumericId(i.variantId || "")}` === key)) {
            state.items.unshift(item);
          }
        }
      })
      .addCase(addWishlistItem.fulfilled, (state, action) => {
        state.loading = false;
        const item = action.payload;
        if (item) {
          const prodId = getNumericId(item.productId);
          const varId = getNumericId(item.variantId || "");
          const key = `${prodId}-${varId}`;
          
          // If it's not already in there (from optimistic add), add it
          if (!state.items.find((i) => `${getNumericId(i.productId)}-${getNumericId(i.variantId || "")}` === key)) {
            state.items.unshift(item);
          }
        }
      })
      .addCase(addWishlistItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        // Revert optimistic add if necessary (optional, but for now we keep it simple)
      })
      .addCase(removeWishlistItem.pending, (state, action) => {
        state.loading = true;
        // Optimistic remove
        const payload = action.meta.arg;
        const productId = getNumericId(typeof payload === 'string' ? payload : payload.productId);
        const variantId = getNumericId(typeof payload === 'string' ? "" : (payload.variantId || ""));
        
        state.items = state.items.filter((item) => {
          const itemProdId = getNumericId(item.productId);
          const itemVarId = getNumericId(item.variantId || "");
          
          if (variantId && variantId !== "0" && variantId !== "") {
            return !(itemProdId === productId && itemVarId === variantId);
          }
          return itemProdId !== productId;
        });
      })
      .addCase(removeWishlistItem.fulfilled, (state, action) => {
        state.loading = false;
        // No need to filter again as it was done in pending, but safe to do so
        const payload = action.payload;
        const productId = getNumericId(typeof payload === 'string' ? payload : payload.productId);
        const variantId = getNumericId(typeof payload === 'string' ? "" : (payload.variantId || ""));
        
        state.items = state.items.filter((item) => {
          const itemProdId = getNumericId(item.productId);
          const itemVarId = getNumericId(item.variantId || "");
          
          if (variantId && variantId !== "0" && variantId !== "") {
            return !(itemProdId === productId && itemVarId === variantId);
          }
          return itemProdId !== productId;
        });
      })
      .addCase(removeWishlistItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(mergeGuestWishlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(mergeGuestWishlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.guestItems = [];
      })
      .addCase(mergeGuestWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const {
  clearWishlist,
  addGuestWishlistItem,
  removeGuestWishlistItem,
  restoreGuestWishlist,
  clearGuestWishlist,
} = wishlistSlice.actions;
export default wishlistSlice.reducer;
