import { logout } from "@/redux/features/user/userSlice";

/**
 * The stable half of a Shopify customer address id.
 *
 * Shopify hands back
 *   gid://shopify/MailingAddress/1100377…?model_name=CustomerAddress&customer_access_token=…
 * — the SESSION'S ACCESS TOKEN is embedded in the id, so the full string must never travel in a
 * URL, and it changes every session so nothing can be keyed on it. The numeric id is the only
 * stable, safe part. The backend keys on the same number (lib/addressMeta.addressKey).
 */
export const addressKey = (gid) =>
  String(gid || "").match(/MailingAddress\/(\d+)/)?.[1] || String(gid || "");

/* ================= GENERIC API FETCH ================= */

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL && process.env.NEXT_PUBLIC_BACKEND_URL.trim() !== "") 
  ? process.env.NEXT_PUBLIC_BACKEND_URL 
  : "http://localhost:8080";

export const apiFetch = async (url, options = {}) => {
  // All /api calls now go to the external backend since the local app/api is removed
  // We ensure the URL is absolute to avoid hitting the Next.js server on port 3000
  let finalUrl = url;
  if (url.startsWith("/api") && !url.startsWith("/api/proxy/")) {
    const base = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    finalUrl = `${base}${url}`;
    
    // Debug log to confirm where requests are actually going
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
       console.log(`[apiFetch] Redirecting ${url} to ${finalUrl}`);
    }
  }

  /**
   * The signed-in customer's token, for the helpers below that do NOT pass one explicitly (the
   * wishlist family is all of them).
   *
   * READ FROM `persist:user`, NOT `persist:root`. This looked inside persist:root for a `user` key
   * and there has never been one: store.js gives the user slice its OWN persist config (so
   * isAuthModalOpen stays out of localStorage), and the root config's whitelist is `recentlyViewed`
   * alone. So `rootState.user` was always undefined, `token` was always null, and every wishlist
   * call in the app has gone out unauthenticated -- which the backend does not reject, it just
   * falls back to the guest sessionId and reads or writes the WRONG ROW. Silent, and exactly the
   * kind of failure that looks like a working feature until someone signs in on a second device.
   *
   * persist:root is still tried as a fallback: harmless, and it costs one localStorage read on a
   * shape that older builds may have written.
   */
  let token = null;
  if (typeof window !== "undefined") {
    try {
      const slice = localStorage.getItem("persist:user");
      // redux-persist stores each value JSON-encoded a second time, so accessToken comes back as
      // the string `"ey..."` -- quotes included -- and has to be parsed again.
      let accessToken = slice ? JSON.parse(JSON.parse(slice).accessToken ?? "null") : null;

      if (!accessToken) {
        const root = localStorage.getItem("persist:root");
        const rootUser = root ? JSON.parse(root).user : null;
        accessToken = rootUser ? JSON.parse(rootUser)?.accessToken ?? null : null;
      }

      if (accessToken) token = `Bearer ${accessToken}`;
    } catch (e) {
      console.warn("[apiFetch] Failed to retrieve token from localStorage:", e);
    }
  }

  const sentAuth = Boolean(token || options.headers?.Authorization);

  try {
    const res = await fetch(finalUrl, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "Authorization": token } : {}),
        ...(options.headers || {}),
      },
    });

    if (res.status === 204 || res.status === 205) return null;

    const contentType = res.headers.get("content-type");
    let data;

    if (contentType?.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
      try { data = JSON.parse(data); } catch(e) {}
    }

    if (!res.ok) {
      // Session expired — but ONLY when this request actually carried the session's token. A 401
      // from an unauthenticated call (a misconfigured endpoint, a guest wishlist poll) must not log
      // the customer out and wipe their cart badge mid-browse.
      if (res.status === 401 && sentAuth) {
        console.warn("[apiFetch] Unauthorized request. Triggering global logout.", finalUrl);
        if (typeof window !== "undefined") {
          const { store } = await import("@/redux/store");
          store.dispatch(logout());
        }
      }

      // Improve error reporting
      const errorMsg = data?.error || data?.message || `HTTP ${res.status}`;
      
      // Downgrade "not found" errors to warnings to prevent console pollution
      if (res.status === 404 || errorMsg.toLowerCase().includes("not found")) {
        console.warn(`[apiFetch Resource Not Found] ${finalUrl}: ${errorMsg}`);
      } else if (res.status === 401 || res.status === 403) {
        console.warn(`[apiFetch Unauthorized] ${finalUrl}: ${errorMsg}`);
      } else if (!options.suppressErrorLog) {
        console.error(`[apiFetch Error] ${finalUrl}: ${errorMsg}`, data);
      }
      
      // The body rides on the error: a 429's retryAfter is how the resend cooldown syncs to the
      // server's clock instead of showing an enabled button the server will keep refusing.
      const error = new Error(errorMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      console.error(`[apiFetch Network Error] Could not connect to ${finalUrl}. Ensure the Fastify backend is running.`);
    }
    throw err;
  }
};
/* ================= AUTH HELPERS ================= */

const normalizeMobile = (mobile) => {
  let clean = String(mobile || "").replace(/\D/g, "");
  if (clean.length === 10) return `91${clean}`;
  return clean;
};

/* ================= SEND OTP ================= */

export const sendOtpApi = (mobile) =>
  apiFetch("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ mobile: normalizeMobile(mobile) }),
  });

/* ================= VERIFY OTP ================= */

export const verifyOtpApi = (mobile, otp, sessionId = null) =>
  apiFetch("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ mobile, otp, sessionId }),
  });

/* ================= REGISTER ================= */

/**
 * There is no /api/auth/check-customer any more. verify-otp already reports whether the number has
 * an account (status LOGIN vs REGISTER_REQUIRED), and a standalone endpoint that answers "is this
 * number registered?" to anyone who asks is a phone-enumeration hole. The jewelry build shipped
 * one.
 *
 * `otpProof` is the short-lived signed token verify-otp returns with REGISTER_REQUIRED. The backend
 * reads the mobile out of THAT and ignores any mobile in this body -- so no mobile is sent. Without
 * it, register would create verified accounts on numbers the caller never proved they own.
 */
export const registerCustomer = ({
  otpProof,
  firstName,
  lastName,
  email,
  acceptsMarketing,
  signupPath,
  signupSource,
  utms,
}) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      otpProof,
      firstName,
      lastName,
      email,
      acceptsMarketing,
      // Recorded as Shopify customer tags, so "which page converted?" is answerable in the admin.
      signupPath,
      signupSource,
      // And "which campaign paid for them?", which the page alone cannot answer.
      utms,
    }),
  });

export const logoutApi = () => apiFetch("/api/auth/logout", { method: "POST" });

/* ================= WISHLIST MERGE (on login) ================= */

// The token is passed explicitly because this runs in the same tick as dispatch(login(...)) --
// redux-persist has not flushed to localStorage yet, so apiFetch's own token lookup finds nothing.
export const mergeWishlistApi = (sessionId, accessToken) =>
  apiFetch("/api/wishlist/merge", {
    method: "POST",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify({ sessionId }),
  });

export const fetchCustomerProfile = (accessToken) =>
  apiFetch("/api/customer/profile", {
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

/**
 * The customer's delivery pincode, on the `custom.pincode` metafield.
 *
 * A pincode is not an address (see the route's own note): it is typed before anyone will give you a
 * house number, and it has to outlive a cleared localStorage. The metafield is what makes it follow
 * the account from a phone to a laptop.
 */
export const fetchCustomerPincode = (accessToken) =>
  apiFetch("/api/customer/pincode", {
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

export const saveCustomerPincode = (pincode, accessToken) =>
  apiFetch("/api/customer/pincode", {
    method: "PUT",
    body: JSON.stringify({ pincode }),
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

export const fetchCustomerCoupons = (accessToken) =>
  apiFetch("/api/customer/coupons", {
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

export const fetchCustomerOrders = (accessToken) =>
  apiFetch("/api/customer/orders", {
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

export const fetchCustomerDashboardStats = (accessToken) =>
  apiFetch("/api/customer/dashboard-stats", {
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

export const fetchCustomerAddresses = (accessToken) => {
  if (!accessToken || accessToken.startsWith('simulated_')) return Promise.resolve({ addresses: [], customer: null, defaultAddressId: null });
  return apiFetch("/api/customer/addresses", {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
};

export const createCustomerAddress = ({ address, makeDefault = false }, accessToken) =>
  apiFetch("/api/customer/addresses", {
    method: "POST",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify({ address, makeDefault }),
  });

export const updateCustomerAddress = ({ addressId, address, makeDefault = false }, accessToken) =>
  apiFetch("/api/customer/addresses", {
    method: "PATCH",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify({ addressId, address, makeDefault, mode: "update" }),
  });

export const selectDefaultCustomerAddress = (addressId, accessToken) =>
  apiFetch("/api/customer/addresses", {
    method: "PATCH",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify({ addressId, mode: "default" }),
  });

export const deleteCustomerAddress = (addressId, accessToken) =>
  apiFetch(`/api/customer/addresses?addressId=${encodeURIComponent(addressId)}`, {
    method: "DELETE",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
  });

export const fetchWishlistApi = (userId = "", sessionId = "") => {
  const q = new URLSearchParams();
  if (userId) q.set("userId", userId);
  if (sessionId) q.set("sessionId", sessionId);
  const path = q.toString() ? `/api/wishlist?${q.toString()}` : "/api/wishlist";
  return apiFetch(path);
};

export const addWishlistApi = (payload, userId = "", sessionId = "") => {
  const q = new URLSearchParams();
  if (userId) q.set("userId", userId);
  if (sessionId) q.set("sessionId", sessionId);
  const path = q.toString() ? `/api/wishlist?${q.toString()}` : "/api/wishlist";
  return apiFetch(path, {
    method: "POST",
    body: JSON.stringify({ product: payload, userId, sessionId }),
  });
};

export const syncWishlistApi = (items, userId = "", sessionId = "") => {
  const q = new URLSearchParams();
  if (userId) q.set("userId", userId);
  if (sessionId) q.set("sessionId", sessionId);
  const path = q.toString() ? `/api/wishlist?${q.toString()}` : "/api/wishlist";
  return apiFetch(path, {
    method: "POST",
    body: JSON.stringify({ items, userId, sessionId }),
  });
};

export const removeWishlistApi = (productId, variantId = "", userId = "", sessionId = "") => {
  const q = new URLSearchParams();
  q.set("productId", productId);
  if (variantId) q.set("variantId", variantId);
  if (userId) q.set("userId", userId);
  if (sessionId) q.set("sessionId", sessionId);
  return apiFetch(`/api/wishlist?${q.toString()}`, {
    method: "DELETE",
  });
};

export const fetchCheckoutAddressSelection = (accessToken) =>
  apiFetch("/api/checkout/address-selection", {
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
  });

export const saveCheckoutAddressSelection = ({ billingAddressMode, billingAddressId = "" }, accessToken) =>
  apiFetch("/api/checkout/address-selection", {
    method: "PATCH",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify({ billingAddressMode, billingAddressId }),
  });

export const createRazorpayOrder = (payload, accessToken) =>
  apiFetch("/api/payment/razorpay/order", {
    method: "POST",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify(payload),
  });

export const completeRazorpayPayment = (payload, accessToken) =>
  apiFetch("/api/payment/razorpay/complete", {
    method: "POST",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify(payload),
  });

/* ================= ATTACH CART ================= */

export const attachCartApi = ({ cartId }, accessToken) =>
  apiFetch("/api/cart/attach", {
    method: "POST",
    headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    body: JSON.stringify({ cartId }),
  });

/* ================= CREATE CART ================= */

export const createCartApi = () =>
  apiFetch("/api/cart/create", {
    method: "POST",
    body: JSON.stringify({}),
  });

/* ================= SEARCH RESULTS ================= */

/**
 * Header search. One call to our own /api/search, which asks Shopify's predictive search -- the
 * index the Search & Discovery app configures, so synonyms and search rules set in the admin apply
 * here without any code change.
 *
 * Was two calls, neither of which could work: `${BACKEND_URL}/api/products/search` against a
 * Fastify service that is not running, and searchContent() against a Storefront client reading
 * NEXT_PUBLIC_* token names that are not set. The route returns products, collections, articles and
 * pages together, so both are gone.
 */
export const fetchSearchResults = async (query) => {
  if (!query) return { results: [] };
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { results: [] };
    return await res.json();
  } catch (err) {
    console.error("[fetchSearchResults] Error:", err);
    return { results: [] };
  }
};
