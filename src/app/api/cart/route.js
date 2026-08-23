import { cookies } from "next/headers";

/**
 * The cart, server side.
 *
 * The Storefront token is server-only by design (see lib/products.js), so the browser cannot talk
 * to Shopify directly and this route is the whole transport: GET reads the cart, POST adds a line.
 *
 * The jewelry build runs its cart from the browser with a NEXT_PUBLIC_ token, then makes a SECOND
 * call to its own Fastify backend per mutation to mirror the same line. The carried-over cartSlice
 * still contains both paths and neither works here -- no public token is set and there is no
 * backend -- which is why the header's badge has always read 0. cartSlice.syncCart calls this
 * instead.
 *
 * The cart id lives in an httpOnly cookie rather than localStorage: it is a bearer token for a cart
 * that carries an address at checkout, and nothing in the browser needs to read it.
 */
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-01";

const CART_COOKIE = "material_cart";
// Shopify abandons a cart after 10 days of inactivity; matching that means the cookie never
// outlives the cart it points at.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 10;

/**
 * @inContext(country: IN) is NOT optional, and its absence fails silently rather than loudly:
 * without it Shopify resolves whichever market it likes -- the US one, where these variants carry
 * an auto-generated $20 price and are not for sale -- and the line collapses to quantity 0 with a
 * ₹0 total and no error. scripts/verify-cart.mjs is where that was found.
 */
const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { amount } totalAmount { amount } }
  # Shopify's own verdict on the code, which is why there is no coupon table in this repo: an
  # unknown or expired code comes BACK in this list with applicable:false rather than erroring, so
  # "is this code real, and does it apply to what is in the cart?" is answered by the one system
  # that knows -- the same discount rules the hosted checkout will enforce a screen later.
  discountCodes { code applicable }
  lines(first: 50) {
    nodes {
      id
      quantity
      attributes { key value }
      cost { totalAmount { amount } }
      merchandise {
        ... on ProductVariant {
          id
          title
          sku
          # Weight is what an unloading charge is actually computed from: carrying 900kg up four
          # floors is a different job from one box, and Shopify already holds the per-variant figure.
          weight
          weightUnit
          price { amount }
          # The was-price, so the cart can show what the customer is saving rather than making them
          # remember it from the PDP.
          compareAtPrice { amount }
          # Whether Shopify will still sell it. A cart that stays silent about stock and then emails
          # "out of stock" two days later is the single fastest way to lose a ₹27,000 order.
          availableForSale
          quantityAvailable
          image { url }
          # id, productType and vendor render nothing -- they are what a cart, checkout and
          # purchase event key on, and a funnel whose PDP step carries a numeric id and whose
          # purchase step carries a handle cannot be joined end to end.
          product { id title handle productType vendor }
        }
      }
    }
  }
`;

const CART_QUERY = `query Cart($id: ID!) @inContext(country: IN) { cart(id: $id) { ${CART_FIELDS} } }`;

const CART_CREATE = `
  mutation CartCreate($input: CartInput!) @inContext(country: IN) {
    cartCreate(input: $input) { cart { ${CART_FIELDS} } userErrors { message } }
  }
`;

const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) @inContext(country: IN) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } }
  }
`;

const CART_LINES_UPDATE = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) @inContext(country: IN) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } }
  }
`;

const CART_DISCOUNT_UPDATE = `
  mutation CartDiscountCodesUpdate($cartId: ID!, $codes: [String!]!) @inContext(country: IN) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $codes) {
      cart { ${CART_FIELDS} } userErrors { message }
    }
  }
`;

const CART_LINES_REMOVE = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) @inContext(country: IN) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { message } }
  }
`;

export async function GET() {
  const id = (await cookies()).get(CART_COOKIE)?.value;
  if (!id) return Response.json(empty());

  const data = await storefront(CART_QUERY, { id });
  // A cart Shopify has since discarded comes back as null, not an error. Report an empty cart
  // rather than an error the header would have to special-case.
  return Response.json(data?.cart ? mapCart(data.cart) : empty());
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const variantId = String(body.variantId ?? "");
  const quantity = Number(body.quantity ?? 0);

  // Validated here rather than trusted from the PDP: this route is reachable directly, and
  // Shopify's own error for a fractional quantity is a 500-shaped GraphQL failure.
  if (!variantId.startsWith("gid://shopify/ProductVariant/")) {
    return Response.json({ error: "Unknown variant" }, { status: 400 });
  }
  // REJECTED, not rounded. Flooring 1.5 to 1 would sell someone a box less than they asked for
  // and report success -- the one failure mode a quantity field must not have.
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return Response.json({ error: "Quantity must be a whole number, 1 to 999" }, { status: 400 });
  }

  // The line carries WHY it is this many boxes, so the packing slip and any support conversation
  // can see the customer asked for 200 sq ft rather than 15 anonymous boxes.
  const attributes = Object.entries(body.attributes ?? {})
    .filter(([, value]) => value != null && value !== "")
    .slice(0, 10)
    .map(([key, value]) => ({ key: String(key).slice(0, 60), value: String(value).slice(0, 200) }));

  const lines = [{ merchandiseId: variantId, quantity, attributes }];
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;

  let cart = null;
  if (existing) {
    const data = await storefront(CART_LINES_ADD, { cartId: existing, lines });
    cart = data?.cartLinesAdd?.cart ?? null;
  }
  // No cart yet, or the one we had has expired -- either way, start a fresh one rather than
  // failing the add. buyerIdentity pairs with @inContext above; both are needed for INR pricing.
  if (!cart) {
    const data = await storefront(CART_CREATE, {
      input: { lines, buyerIdentity: { countryCode: "IN" } },
    });
    const errors = data?.cartCreate?.userErrors;
    if (errors?.length) return Response.json({ error: errors[0].message }, { status: 502 });
    cart = data?.cartCreate?.cart ?? null;
  }

  if (!cart) return Response.json({ error: "Could not reach the cart" }, { status: 502 });

  jar.set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return Response.json(mapCart(cart));
}

/**
 * Change one line's quantity, from the cart page's stepper. Quantity 0 removes the line -- one
 * verb for both, because "one fewer" and "none" are the same gesture to the customer.
 *
 * Also carries the COUPON, on `discountCode`, because applying one is the same shape of request:
 * change something about this cart, get the whole cart back. An empty string clears it.
 */
export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  if ("discountCode" in body) return applyDiscount(body.discountCode);

  const lineId = String(body.lineId ?? "");
  const quantity = Number(body.quantity ?? -1);

  // Same posture as POST: this route is reachable directly, so nothing from the page is trusted.
  if (!lineId.startsWith("gid://shopify/CartLine/")) {
    return Response.json({ error: "Unknown cart line" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) {
    return Response.json({ error: "Quantity must be a whole number, 0 to 999" }, { status: 400 });
  }

  const id = (await cookies()).get(CART_COOKIE)?.value;
  if (!id) return Response.json(empty());

  const data =
    quantity === 0
      ? await storefront(CART_LINES_REMOVE, { cartId: id, lineIds: [lineId] })
      : await storefront(CART_LINES_UPDATE, { cartId: id, lines: [{ id: lineId, quantity }] });

  const cart = data?.cartLinesRemove?.cart ?? data?.cartLinesUpdate?.cart ?? null;
  if (!cart) return Response.json({ error: "Could not reach the cart" }, { status: 502 });

  return Response.json(mapCart(cart));
}

/**
 * Apply a discount code, or clear it with "".
 *
 * NOT VALIDATED HERE beyond trimming and a length cap. Shopify owns the discount rules -- whether
 * the code exists, whether it has expired, whether it covers what is in this cart -- and it answers
 * by echoing the code back with `applicable: false` rather than by failing, which is exactly the
 * answer the field needs. Duplicating any of those rules in this repo would create a second opinion
 * that can disagree with the checkout the customer reaches thirty seconds later.
 *
 * ONE code at a time: Shopify's mutation takes a list, this sends a list of one. Stacked discounts
 * are a policy nobody has asked for, and the field that would express them does not exist yet.
 */
async function applyDiscount(raw) {
  const code = String(raw ?? "").trim().slice(0, 40);

  const id = (await cookies()).get(CART_COOKIE)?.value;
  // No cart, no discount to hold it. Answering with an empty cart rather than an error keeps this
  // the same shape as GET on an expired cart.
  if (!id) return Response.json(empty());

  const data = await storefront(CART_DISCOUNT_UPDATE, { cartId: id, codes: code ? [code] : [] });
  const cart = data?.cartDiscountCodesUpdate?.cart ?? null;
  if (!cart) return Response.json({ error: "Could not reach the cart" }, { status: 502 });

  return Response.json(mapCart(cart));
}

async function storefront(query, variables) {
  if (!DOMAIN || !TOKEN) return null;
  try {
    const res = await fetch(`https://${DOMAIN}/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": TOKEN },
      body: JSON.stringify({ query, variables }),
      // A cart is per-customer and changes on every mutation. Nothing here may be cached.
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[api/cart] Shopify returned ${res.status}`);
      return null;
    }
    const { data, errors } = await res.json();
    if (errors?.length) {
      console.warn("[api/cart]", errors[0].message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("[api/cart] request failed:", err.message);
    return null;
  }
}

/** The shape cartSlice stores -- deliberately the same keys the carried-over slice already uses. */
function mapCart(cart) {
  return {
    // Exposed so login can hand this cart to the account (POST /api/cart/attach on material-backend,
    // which is what makes the cart follow the customer to another device). The id itself lives in an
    // httpOnly cookie the browser cannot read, and the backend is on another origin so it cannot see
    // that cookie either -- somebody has to say the id out loud, and this is the only place that can.
    cartId: cart.id ?? null,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity ?? 0,
    totalAmount: Number(cart.cost?.totalAmount?.amount ?? 0),
    // Kilograms, summed across lines. Shopify reports per-variant weight in whatever unit the
    // merchant set, so it is normalised here rather than at three call sites.
    totalWeightKg: Number(
      (cart.lines?.nodes ?? []).reduce((sum, line) => {
        const w = Number(line.merchandise?.weight ?? 0);
        const unit = line.merchandise?.weightUnit;
        const kg = unit === "GRAMS" ? w / 1000 : unit === "POUNDS" ? w * 0.4536 : unit === "OUNCES" ? w * 0.0283 : w;
        return sum + kg * (line.quantity ?? 0);
      }, 0).toFixed(2),
    ),
    // BEFORE any discount. totalAmount is after, so the saving is the difference -- taken from
    // Shopify's own two figures rather than recomputed from a percentage this app would have to
    // know. With no coupon on the cart the two are equal and the summary shows one line.
    subtotal: Number(cart.cost?.subtotalAmount?.amount ?? 0),
    // `applicable: false` is a code Shopify is holding but not honouring -- the customer typed
    // something that does not apply. The page needs to tell those two apart, so both travel.
    discount: cart.discountCodes?.[0]
      ? {
          code: cart.discountCodes[0].code,
          applicable: Boolean(cart.discountCodes[0].applicable),
        }
      : null,
    items: (cart.lines?.nodes ?? []).map((line) => ({
      lineId: line.id,
      variantId: line.merchandise?.id,
      // Analytics keys. Named to match what a card product and a PDP product already say, so one
      // item mapper in lib/gtm.js reads all three without a fallback chain per field.
      productId: line.merchandise?.product?.id ?? null,
      category: line.merchandise?.product?.productType || null,
      vendor: line.merchandise?.product?.vendor || null,
      title: line.merchandise?.product?.title ?? "",
      handle: line.merchandise?.product?.handle ?? "",
      variantTitle: line.merchandise?.title ?? "",
      sku: line.merchandise?.sku ?? null,
      image: line.merchandise?.image?.url ?? null,
      price: Number(line.merchandise?.price?.amount ?? 0),
      comparePrice: Number(line.merchandise?.compareAtPrice?.amount ?? 0) || null,
      // ponytail: inventory is not tracked, so a cart line is never blocked as out of stock.
      // CartPage's out-of-stock banner self-disables; it returns if stock is ever tracked again.
      inStock: true,
      // Only surfaced when it is low AND real. Shopify returns null when inventory is untracked,
      // and "only 3 left" invented from a null is the fake-scarcity trick this store does not do.
      stockLeft:
        typeof line.merchandise?.quantityAvailable === "number"
          ? line.merchandise.quantityAvailable
          : null,
      // Per line, in kg — a customer moving 224kg should be able to see which line is the weight.
      weightKg:
        Math.round(
          (() => {
            const w = Number(line.merchandise?.weight ?? 0);
            const u = line.merchandise?.weightUnit;
            const kg = u === "GRAMS" ? w / 1000 : u === "POUNDS" ? w * 0.4536 : u === "OUNCES" ? w * 0.0283 : w;
            return kg * (line.quantity ?? 0);
          })() * 100,
        ) / 100,
      quantity: line.quantity,
      total: Number(line.cost?.totalAmount?.amount ?? 0),
      properties: Object.fromEntries((line.attributes ?? []).map((a) => [a.key, a.value])),
    })),
  };
}

const empty = () => ({
  cartId: null,
  checkoutUrl: null,
  totalQuantity: 0,
  totalAmount: 0,
  subtotal: 0,
  discount: null,
  items: [],
});
