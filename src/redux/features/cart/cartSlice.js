import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

/**
 * The cart.
 *
 * WHAT THIS FILE USED TO BE. 1,045 lines carried over from the jewelry build this project was
 * adapted from: seven thunks (fetchCart, addToCart, removeFromCart, removeMultipleFromCart,
 * updateCartItem, mergeCart, repriceCartForCheckout) that called the Storefront API straight from
 * the browser with NEXT_PUBLIC_STOREFRONT_TOKEN -- never set, because the token is server-only on
 * purpose -- and mirrored every mutation into a Fastify backend that does not exist in this
 * project. Alongside them: a coupon table, a loyalty-points balance, and a cart-drawer open/closed
 * flag. Nothing in this app imported any of it, which is why the header's cart badge read 0 for as
 * long as it did.
 *
 * All of it is gone (user, 2026-08-15). What is left is what the app actually dispatches:
 *
 *   syncCart      one thunk, one route. No argument reads the cart; {add} adds a line;
 *                 {update: {lineId, quantity}} changes one (0 removes it); {coupon: "CODE"} applies
 *                 a discount ("" clears it). Every one of them returns the SAME payload -- the
 *                 whole cart, as /api/cart mapped it -- so a PDP add and the header badge can never
 *                 disagree, because they are one response.
 *   clearCart     local reset on logout and on leaving the account page.
 *   getSessionId  a guest id in localStorage, used by AuthForm to attach a guest cart at signin.
 *
 * The AUTHORITATIVE cart is an httpOnly cookie that /api/cart owns; this slice is a view of it.
 * That is why there is no cart-id juggling here any more and no direct Shopify call: the token
 * stays on the server, and one place decides what the cart is.
 */

/**
 * A guest's id, for handing a cart built while signed out to the account being signed into.
 * Read by AuthForm. Not a security boundary -- the cart itself is cookie-backed and server-owned.
 */
export const getSessionId = () => {
  if (typeof window === "undefined") return null;
  let sessionId = localStorage.getItem("cart_session_id");
  if (!sessionId) {
    sessionId = "sess_" + Math.random().toString(36).slice(2, 11) + Date.now();
    localStorage.setItem("cart_session_id", sessionId);
  }
  return sessionId;
};

/**
 * Read or write the cart, in one thunk, because every one of those returns the same payload into
 * the same fields.
 *
 * ponytail: split it when a caller needs to write without re-reading -- Shopify returns the whole
 * cart from a mutation anyway, so that day may not come.
 */
export const syncCart = createAsyncThunk(
  "cart/syncCart",
  // {add} POSTs a new line, {update: {lineId, quantity}} PATCHes one (0 removes it),
  // {coupon: "CODE"} PATCHes the discount ("" clears it), none of them GETs.
  //
  // `coupon !== undefined` rather than a truthy test, because "" is a real instruction here -- it is
  // how the customer removes a code, and a truthy test would silently turn that into a plain read.
  async ({ add, update, coupon } = {}, { rejectWithValue }) => {
    const write = (method, body) => ({
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await fetch(
      "/api/cart",
      add
        ? write("POST", add)
        : update
          ? write("PATCH", update)
          : coupon !== undefined
            ? write("PATCH", { discountCode: coupon })
            : { method: "GET" },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) return rejectWithValue(data?.error || "Could not reach the cart");
    return data;
  },
);

const initialState = {
  items: [],
  totalQuantity: 0,
  totalAmount: 0,
  // Pre-discount, so the cart page can show what a coupon took off. Equal to totalAmount whenever
  // no coupon applies, which is the normal case.
  subtotal: 0,
  // The Shopify cart this browser is holding. Read from /api/cart rather than kept here as the
  // source of truth -- the authoritative copy is an httpOnly cookie.
  cartId: null,
  // Drives the unloading estimate on the shipping step.
  totalWeightKg: 0,
  // Shopify's own hosted checkout for this cart. Held here rather than rebuilt from the cart id,
  // which is what the jewelry build does and what breaks when a cart expires.
  checkoutUrl: null,
  // {code, applicable} as Shopify reports it, or null. WRITTEN ONLY BY syncCart -- there is no
  // local applyCoupon reducer any more, because a coupon this app decided about on its own can
  // disagree with the checkout the customer reaches thirty seconds later.
  appliedCoupon: null,
  loading: false,
  error: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    /**
     * Local reset, for logout and for leaving the account page. It does NOT empty the server cart:
     * the cookie is what holds that, and a customer signing out on a shared machine should not have
     * the next person's session inherit -- or destroy -- their basket.
     */
    clearCart: (state) => {
      state.items = [];
      state.totalQuantity = 0;
      state.totalAmount = 0;
      state.subtotal = 0;
      state.appliedCoupon = null;
      state.error = null;

      // Keys the old jewelry cart wrote. Cleared rather than left behind, so a stale id cannot
      // resurrect a cart into a fresh session.
      if (typeof window !== "undefined") {
        localStorage.removeItem("shopify_cart_id");
        localStorage.removeItem("checkout_selection");
        localStorage.removeItem("checkoutBillingAddressSelection");
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Global logout, dispatched by the user slice. Same reset as clearCart.
      .addCase("user/logout", (state) => {
        state.items = [];
        state.totalQuantity = 0;
        state.totalAmount = 0;
        state.subtotal = 0;
        state.appliedCoupon = null;
        state.error = null;

        if (typeof window !== "undefined") {
          localStorage.removeItem("shopify_cart_id");
          localStorage.removeItem("checkout_selection");
          localStorage.removeItem("checkoutBillingAddressSelection");
        }
      })
      .addCase(syncCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(syncCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload?.items ?? [];
        state.totalQuantity = action.payload?.totalQuantity ?? 0;
        state.totalAmount = action.payload?.totalAmount ?? 0;
        state.subtotal = action.payload?.subtotal ?? action.payload?.totalAmount ?? 0;
        state.checkoutUrl = action.payload?.checkoutUrl ?? null;
        // Needed at login to hand this cart to the account -- see /api/cart's mapCart.
        state.cartId = action.payload?.cartId ?? null;
        state.totalWeightKg = action.payload?.totalWeightKg ?? 0;
        state.appliedCoupon = action.payload?.discount ?? null;
      })
      // The cart is left ALONE on failure. A network blip must not empty a cart the customer can
      // still see, and /api/cart already answers with an empty cart when Shopify has discarded it.
      .addCase(syncCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearCart } = cartSlice.actions;
export default cartSlice.reducer;
