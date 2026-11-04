// src/lib/gtm.js

/**
 * Every dataLayer push this store makes, in one file.
 *
 * PORTED FROM THE JEWELRY BUILD, with one deliberate difference. Event NAMES and WRAPPER KEYS are
 * identical to Lucira's so an existing GTM container's triggers and variables map across unchanged
 * (`productImpression` still carries `products`, `purchase` still carries `eventModel`, and so on).
 * The FIELD NAMES INSIDE are not: Lucira spells the same fact four ways depending on which file
 * fired it -- `productName` / `product_name` / `item_name`, `item_id` / `id` / `productId`, a price
 * that is a Number in the cart and a String on the card -- so every tag in the container needs a
 * per-event variable and a rename in one place breaks three others. Here there is ONE item shape
 * (`gtmItem` below) and one customer shape, used by all of them.
 *
 * PRICE vs OFFER_PRICE, decided once and true everywhere:
 *   price        what we are actually selling it for -- the lower number, what gets charged.
 *   offer_price  the was-price / compare-at / MRP -- the higher number. Falls back to `price`
 *                when the product carries no compare-at, so it is never 0 and never null.
 * Both are Numbers, both rounded to paise. Reading a discount is `offer_price - price`, in every
 * event, with no per-event special case.
 *
 * THE CONTAINER SNIPPET IS NOT HERE -- it is in app/layout.js, loaded from NEXT_PUBLIC_GTM_ID.
 * `window.dataLayer` is created on first push, so events fired before the container loads queue up
 * correctly -- that is what dataLayer is for.
 */

const BRAND = "Texture House";
const CURRENCY = "INR";

/**
 * Identical events fired inside a second of each other are almost always a component remounting,
 * not a customer doing something twice. Dropped for pageView, warned about in dev for the rest --
 * an addToCart repeated with DIFFERENT data is a real second add and must still get through.
 */
const lastPushedEvents = new Map();
const MIN_EVENT_INTERVAL_MS = 1000;

export const pushToDataLayer = (data) => {
  if (typeof window === "undefined") return;

  if (data.event) {
    const now = Date.now();
    // pageView dedups on event+path, not event alone: a fast redirect (guarded checkout page →
    // cart) is two REAL page views inside a second, and keying on the event name swallowed the
    // second one.
    const key = data.event === "pageView" ? `pageView:${data.page_path || data.page_location || ""}` : data.event;
    const lastPush = lastPushedEvents.get(key);
    if (lastPush && now - lastPush < MIN_EVENT_INTERVAL_MS) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[GTM] rapid repeat of "${data.event}"`);
      }
      if (data.event === "pageView") return;
    }
    lastPushedEvents.set(key, now);
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(data);
};

/* ------------------------------------------------------------------ value helpers */

/**
 * "gid://shopify/ProductVariant/45678" -> 45678. GTM, GA4 and every ad platform want the bare
 * number; the gid is a Shopify transport detail and joining a report on it is a lifetime of
 * URL-encoding bugs.
 */
export const getNumericId = (gid) => {
  if (!gid) return 0;
  if (typeof gid === "number") return gid;
  const match = String(gid).match(/\d+$/);
  return match ? Number(match[0]) : 0;
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Paise, not floating-point noise. 1844.4999999999998 in a revenue report is a support ticket. */
const money = (value) => Math.round(num(value) * 100) / 100;

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

/* -------------------------------------------------------------------- the item shape */

/**
 * ONE product, as every product-bearing event spells it.
 *
 * The input is whatever this app already holds -- a card product from `mapProducts`, a cart line
 * from /api/cart, or a PDP product+variant merged by `gtmProductItem` below. Those three shapes
 * were made to agree upstream (they all say `title`, `price`, `comparePrice`, `handle`), so this
 * needs a fallback chain in exactly two places rather than Lucira's five-deep `||` ladders:
 *
 *   item_id     `productId` on a cart line, `id` on a product. Falls back to the HANDLE, which is
 *               also unique and stable -- better than emitting "0" for a product whose id did not
 *               make it through, because a handle can still be joined against the catalogue.
 *   item_image  cart lines carry one `image`, cards carry an `images` array.
 *
 * `index` is 1-based on the way out: it is a position in a list a human is looking at, and GA4's
 * own item_list reports read it that way.
 */
export const gtmItem = (source, index = 0) => {
  const price = money(source?.price);
  return {
    item_id: String(getNumericId(source?.productId ?? source?.id) || source?.handle || ""),
    variant_id: String(getNumericId(source?.variantId) || ""),
    item_sku: source?.sku || "",
    item_name: source?.title || "",
    item_brand: source?.vendor || BRAND,
    item_category: source?.category || "",
    item_variant: source?.variantTitle || "",
    item_handle: source?.handle || "",
    item_url: source?.handle ? `${origin()}/products/${source.handle}` : "",
    item_image: source?.image || source?.images?.[0] || "",
    price,
    // The was-price. Never below the selling price and never absent -- a compare-at that Shopify
    // left blank means "no discount", which is offer_price === price, not 0.
    offer_price: Math.max(money(source?.comparePrice), price),
    currency: CURRENCY,
    quantity: Number(source?.quantity ?? 1),
    index: index + 1,
  };
};

/**
 * A PDP's product + the variant actually selected, flattened into what `gtmItem` reads. The PDP is
 * the one place holding two objects instead of one, so it gets the one adapter rather than
 * teaching `gtmItem` about a second argument.
 */
export const gtmProductItem = (product, variant, quantity = 1) =>
  gtmItem(
    {
      id: product?.id,
      handle: product?.handle,
      title: product?.title,
      category: product?.category,
      vendor: product?.vendor,
      variantId: variant?.id,
      variantTitle: variant?.title,
      sku: variant?.sku,
      // The PDP prices per sq ft when the variant carries coverage, and that is the number on the
      // screen -- so it is the number in the event. Pack price when it does not.
      price: variant?.perSqFt > 0 ? variant.perSqFt : variant?.price,
      comparePrice: variant?.perSqFt > 0 ? variant.perSqFtCompare : variant?.comparePrice,
      image: variant?.image || product?.media?.[0]?.url,
      quantity,
    },
  );

/** A list of cart lines or card products, in order. */
export const gtmItems = (list) => (list ?? []).map((item, i) => gtmItem(item, i));

/* ------------------------------------------------------------------ shared payloads */

/**
 * The customer, spelled one way. Used by customerData, login, signup and logout alike -- Lucira
 * sends `first_name`/`last_name` from the header, `name` from the login form and `id` as a raw gid
 * from one of them, so the container cannot tell three of its own events apart.
 */
export const gtmCustomer = (user) => ({
  customer_id: String(getNumericId(user?.id) || user?.id || ""),
  customer_name:
    user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "",
  customer_email: user?.email || "",
  customer_mobile: String(user?.mobile || user?.phone || ""),
});

/** Campaign fields, spelled one way, from wherever the caller read them. */
export const gtmMarketing = (source) => ({
  utm_source: source?.utm_source || "",
  utm_medium: source?.utm_medium || "",
  utm_campaign: source?.utm_campaign || "",
  utm_term: source?.utm_term || "",
  utm_content: source?.utm_content || "",
  gclid: source?.gclid || "",
  fbclid: source?.fbclid || "",
});

/**
 * The body every checkout-funnel event shares: what is being bought, for how much, under which
 * coupon. begin_checkout, add_shipping_info, add_payment_info, purchase and Payment failure all
 * carry this and add at most two fields of their own, so a container variable written once reads
 * the value off every step of the funnel.
 */
export const gtmCheckout = ({ items, value, coupon, ...rest }) => ({
  currency: CURRENCY,
  value: money(value),
  coupon: coupon || "NA",
  total_quantity: (items ?? []).reduce((sum, i) => sum + Number(i.quantity ?? 0), 0),
  total_product: (items ?? []).length,
  items: gtmItems(items),
  ...rest,
});

/* --------------------------------------------------------------------- page + user */

export const pushPageView = (pageData) => pushToDataLayer({ event: "pageView", pageData });

export const pushCustomerData = (customer) =>
  pushToDataLayer({ event: "customerData", customer });

export const pushMarketingData = (marketing) =>
  pushToDataLayer({ event: "marketingData", marketing });

export const pushLogin = (user) => pushToDataLayer({ event: "login", user: gtmCustomer(user) });

export const pushSignup = (user) => pushToDataLayer({ event: "signup", user: gtmCustomer(user) });

export const pushLogout = (user) => pushToDataLayer({ event: "logout", user: gtmCustomer(user) });

export const pushNewsletterSubscription = (email) =>
  pushToDataLayer({ event: "newsletterSubscription", newsletter: { email: email || "" } });

/* ------------------------------------------------------------------------- product */

/**
 * @param {Array} products already-mapped items, in the order they appear on screen
 * @param {string} listName which listing they were seen in, so two grids do not merge in reporting
 */
export const pushProductImpression = (products, listName = "") =>
  pushToDataLayer({
    event: "productImpression",
    item_list_name: listName,
    products,
  });

export const pushProductClick = (product) =>
  pushToDataLayer({ event: "productClick", products: product });

export const pushProductView = (product) =>
  pushToDataLayer({ event: "productView", products: product });

/* ---------------------------------------------------------------- cart + wishlist */

export const pushAddToCart = ({ products, eventId }) =>
  pushToDataLayer({
    event: "addToCart",
    eventId: eventId || `atc_${Date.now()}`,
    products,
  });

/** Lucira nests this one under `ecommerce.product`; kept, so the container's tag still fires. */
export const pushRemoveFromCart = (product) =>
  pushToDataLayer({ event: "removeFromCart", ecommerce: { product } });

export const pushViewCart = (cart) => pushToDataLayer({ event: "viewCart", cart });

export const pushAddToWishlist = (product) =>
  pushToDataLayer({ event: "addToWishlist", products: product });

export const pushRemoveFromWishlist = (product) =>
  pushToDataLayer({ event: "removeFromWishlist", product });

/* ------------------------------------------------------------------- checkout funnel */

const pushEventModel = (event, eventModel) => pushToDataLayer({ event, eventModel });

export const pushBeginCheckout = (data) => pushEventModel("begin_checkout", data);
export const pushAddShippingInfo = (data) => pushEventModel("add_shipping_info", data);
export const pushAddPaymentInfo = (data) => pushEventModel("add_payment_info", data);
export const pushPurchase = (data) => pushEventModel("purchase", data);

/**
 * Where the purchase payload waits out the redirect.
 *
 * The payment page holds the line items; the success page holds the confirmation. Between them the
 * cart is emptied, so the event has to be written down on one side and fired on the other. Removed
 * the instant it is read, which is also what stops a refresh of the receipt reporting a second
 * order -- see the success page.
 */
export const GTM_PURCHASE_KEY = "gtm_purchase_data";

/** The one event Lucira puts under `ecommerce` rather than `eventModel`. Kept as-is. */
export const pushPaymentFailure = (data) =>
  pushToDataLayer({ event: "Payment failure", ecommerce: data });
