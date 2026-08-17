import { createSlice } from "@reduxjs/toolkit";

/**
 * The products the customer has opened, newest first, persisted in localStorage via the root
 * persist config so the trail survives a refresh.
 *
 * Each entry is a CARD-shaped product -- toCardProduct in lib/product.js builds it from the PDP's
 * data -- so the rail renders it through the same ProductCard as every shelf. The jewelry build's
 * version of this slice picked twenty jewelry fields (reviews, colours, metafields) that no card
 * here reads; storing the payload as-is and keying on handle is the whole job.
 */
const MAX_RECENTLY_VIEWED = 12;

const recentlyViewedSlice = createSlice({
  name: "recentlyViewed",
  initialState: { products: [] },
  reducers: {
    addRecentlyViewed(state, { payload }) {
      if (!payload?.handle) return;
      // Re-viewing a product moves it to the front rather than duplicating it.
      state.products = [
        payload,
        ...state.products.filter((p) => p.handle !== payload.handle),
      ].slice(0, MAX_RECENTLY_VIEWED);
    },
  },
});

export const { addRecentlyViewed } = recentlyViewedSlice.actions;

export default recentlyViewedSlice.reducer;
