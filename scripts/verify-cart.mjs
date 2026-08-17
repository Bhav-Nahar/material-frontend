/**
 * Proves the commercial spine: area -> boxes -> cart -> checkout URL, via the Storefront Cart API.
 *
 *   node scripts/verify-cart.mjs
 *
 * Creates a throwaway guest cart. Nothing is purchased; the cart is abandoned at the end and the
 * checkout URL is only printed, never followed.
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
  const r = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  for (const v of Object.values(j.data ?? {})) {
    if (v?.userErrors?.length) throw new Error(JSON.stringify(v.userErrors));
  }
  return j.data;
};

const money = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

// 1. the variant a customer would pick
const { product } = await api(
  `query($h: String!) {
     product(handle: $h) {
       title
       variants(first: 10) {
         nodes {
           id title availableForSale
           price { amount }
           unitPrice { amount }
           unitPriceMeasurement { quantityValue }
           packUnit: metafield(namespace: "custom", key: "pack_unit") { value }
         }
       }
     }
   }`,
  { h: "wood-floor-tile-nordic-honey-1200x200" },
);

const v = product.variants.nodes.find((n) => n.availableForSale);
if (!v) throw new Error("no purchasable variant");

const coverage = Number(v.unitPriceMeasurement.quantityValue);
const packPrice = Number(v.price.amount);
const perSqFt = Number(v.unitPrice.amount);
const pack = v.packUnit?.value ?? "box";

// 2. what the calculator will do
const area = 200;
const wastage = 0.1;
const boxes = Math.ceil((area * (1 + wastage)) / coverage);

console.log(`${product.title} — ${v.title}`);
console.log(`  ${money(perSqFt)}/sq ft · ${money(packPrice)}/${pack} · ${coverage} sq ft per ${pack}`);
console.log(`  customer wants ${area} sq ft, +${wastage * 100}% wastage → ${boxes} ${pack}es\n`);

// 3. cart, carrying the intent so the order explains itself
// @inContext + buyerIdentity are BOTH required. Without them cartCreate resolves whichever market
// it likes -- here the US one, where this variant has an auto-generated $20 price and is not for
// sale, so the line silently collapses to quantity 0 and the cart totals ₹0 with no error.
const { cartCreate } = await api(
  `mutation($input: CartInput!) @inContext(country: IN) {
     cartCreate(input: $input) {
       cart {
         id
         checkoutUrl
         totalQuantity
         cost { subtotalAmount { amount currencyCode } totalAmount { amount } }
         lines(first: 5) {
           nodes {
             quantity
             attributes { key value }
             cost { totalAmount { amount } }
             merchandise { ... on ProductVariant { title sku } }
           }
         }
       }
       userErrors { field message }
     }
   }`,
  {
    input: {
      buyerIdentity: { countryCode: "IN" },
      lines: [
        {
          merchandiseId: v.id,
          quantity: boxes,
          attributes: [
            { key: "Area", value: `${area} sq ft` },
            { key: "Wastage", value: `${wastage * 100}%` },
            { key: "Covers", value: `${(boxes * coverage).toFixed(1)} sq ft` },
          ],
        },
      ],
    },
  },
);

const cart = cartCreate.cart;
const line = cart.lines.nodes[0];

console.log("CART");
console.log(`  line        ${line.merchandise.title} (${line.merchandise.sku}) × ${line.quantity}`);
for (const a of line.attributes) console.log(`  ${a.key.padEnd(11)} ${a.value}`);
console.log(`  line total  ${money(Number(line.cost.totalAmount.amount))}`);
console.log(`  subtotal    ${money(Number(cart.cost.subtotalAmount.amount))} ${cart.cost.subtotalAmount.currencyCode}`);

// 4. does the money agree with the calculator?
const expected = boxes * packPrice;
const actual = Number(cart.cost.subtotalAmount.amount);
const agrees = Math.abs(expected - actual) < 0.01;
console.log(`\n  calculator said ${money(expected)}, Shopify charged ${money(actual)} — ${agrees ? "MATCH" : "MISMATCH"}`);
console.log(`  checkout    ${cart.checkoutUrl.split("?")[0]}…`);

// 5. quantity is whole boxes only -- confirm Shopify refuses a fraction
let fractionRejected = false;
try {
  await api(
    `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
       cartLinesAdd(cartId: $cartId, lines: $lines) { cart { totalQuantity } userErrors { field message } }
     }`,
    { cartId: cart.id, lines: [{ merchandiseId: v.id, quantity: 1.5 }] },
  );
} catch {
  fractionRejected = true;
}
console.log(`  fractional quantity rejected: ${fractionRejected ? "yes" : "NO — enforce in the UI"}`);

process.exit(agrees ? 0 : 1);
