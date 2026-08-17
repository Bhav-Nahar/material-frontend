/**
 * Proves the coupon path: cartDiscountCodesUpdate against a real cart, and that Shopify reports an
 * unknown code as `applicable: false` rather than by failing -- which is the whole basis for having
 * no coupon table in this repo.
 *
 *   node scripts/verify-coupon.mjs            # nonsense code, expects applicable:false
 *   node scripts/verify-coupon.mjs SAVE10     # a code you created in Shopify Admin
 *
 * Creates a throwaway guest cart. Nothing is purchased and no checkout URL is followed.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const api = async (query, variables = {}) => {
  const r = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  for (const v of Object.values(j.data ?? {})) {
    if (v?.userErrors?.length) throw new Error(JSON.stringify(v.userErrors));
  }
  return j.data;
};

const money = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

// The same fields /api/cart asks for, so a shape that passes here is the shape the route gets.
const FIELDS = `
  id
  cost { subtotalAmount { amount } totalAmount { amount } }
  discountCodes { code applicable }
`;

const CODE = process.argv[2] ?? "DEFINITELY-NOT-A-REAL-CODE";

// 1. any sellable variant will do -- this is about the discount, not the pricing
const { products } = await api(`
  { products(first: 10) { nodes { title variants(first: 5) { nodes { id availableForSale } } } } }
`);

const variant = products.nodes
  .flatMap((p) => p.variants.nodes)
  .find((v) => v.availableForSale);

if (!variant) throw new Error("No sellable variant in the store — cannot build a cart.");

// 2. a cart with one line
const { cartCreate } = await api(
  `mutation($input: CartInput!) @inContext(country: IN) {
     cartCreate(input: $input) { cart { ${FIELDS} } userErrors { message } }
   }`,
  { input: { lines: [{ merchandiseId: variant.id, quantity: 1 }], buyerIdentity: { countryCode: "IN" } } },
);

const before = cartCreate.cart;
console.log(`cart      ${before.id.split("/").pop()}`);
console.log(`subtotal  ${money(Number(before.cost.subtotalAmount.amount))}`);
console.log(`total     ${money(Number(before.cost.totalAmount.amount))}\n`);

// 3. the mutation the route runs
const { cartDiscountCodesUpdate } = await api(
  `mutation($cartId: ID!, $codes: [String!]!) @inContext(country: IN) {
     cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $codes) {
       cart { ${FIELDS} } userErrors { message }
     }
   }`,
  { cartId: before.id, codes: [CODE] },
);

const after = cartDiscountCodesUpdate.cart;
const held = after.discountCodes[0];

console.log(`applied   "${CODE}"`);
console.log(`held as   ${JSON.stringify(held)}`);
console.log(`subtotal  ${money(Number(after.cost.subtotalAmount.amount))}`);
console.log(`total     ${money(Number(after.cost.totalAmount.amount))}`);

const saving = Number(after.cost.subtotalAmount.amount) - Number(after.cost.totalAmount.amount);
console.log(`saving    ${money(saving)}\n`);

// The assertions the cart page depends on.
if (!held || held.code !== CODE) {
  throw new Error(`Shopify did not echo the code back. Got: ${JSON.stringify(after.discountCodes)}`);
}
if (held.applicable && saving <= 0) {
  throw new Error("Code reported applicable but subtotal and total are equal — nothing came off.");
}
if (!held.applicable && saving !== 0) {
  throw new Error("Code reported NOT applicable but the total moved anyway.");
}

console.log(
  held.applicable
    ? `PASS — "${CODE}" is applicable and took ${money(saving)} off.`
    : `PASS — "${CODE}" is held with applicable:false and changed nothing, which is what the cart page renders as "not valid for this order".`,
);
