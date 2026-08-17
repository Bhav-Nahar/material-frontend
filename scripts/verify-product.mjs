/**
 * Reads products back through the Storefront API exactly as the frontend does, and reports whether
 * each field the product card and the coverage calculator depend on is actually set.
 *
 * Run after creating a product in the Shopify admin:
 *   node scripts/verify-product.mjs
 *
 * Checks the things that silently produce a blank or wrong card:
 *   - the product is visible to the Storefront API at all (i.e. published to the headless channel)
 *   - unit price is configured, which is where per-sq-ft and box coverage both come from
 *   - metafields are readable (a definition without Storefront access returns null, not an error)
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

const DOMAIN = env.SHOPIFY_STORE_DOMAIN;
const TOKEN = env.SHOPIFY_STOREFRONT_TOKEN;
const VERSION = env.SHOPIFY_API_VERSION ?? "2026-01";

const QUERY = `
  query Verify($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        handle
        title
        productType
        tags
        availableForSale
        featuredImage { url }
        images(first: 5) { nodes { url } }
        variants(first: 5) {
          nodes {
            title
            sku
            availableForSale
            price { amount currencyCode }
            compareAtPrice { amount }
            unitPrice { amount }
            unitPriceMeasurement { quantityValue quantityUnit referenceValue referenceUnit }
            pieces: metafield(namespace: "custom", key: "pieces_per_pack") { value }
            packUnit: metafield(namespace: "custom", key: "pack_unit") { value }
          }
        }
      }
    }
  }
`;

const tick = (ok) => (ok ? "  ok  " : " MISS ");
const rupees = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

const res = await fetch(`https://${DOMAIN}/api/${VERSION}/graphql.json`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": TOKEN },
  body: JSON.stringify({ query: QUERY, variables: { first: 10 } }),
});

if (!res.ok) {
  console.error(`Storefront API returned ${res.status}. Check SHOPIFY_STOREFRONT_TOKEN.`);
  process.exit(1);
}

const { data, errors } = await res.json();
if (errors?.length) {
  console.error("GraphQL errors:");
  for (const e of errors) console.error(" -", e.message);
  process.exit(1);
}

const products = data?.products?.nodes ?? [];
console.log(`store: ${DOMAIN}   api: ${VERSION}`);
console.log(`products visible to the Storefront API: ${products.length}\n`);

if (products.length === 0) {
  console.log("Nothing came back. Either no product exists yet, or it is not published to the");
  console.log("sales channel this token belongs to — a product visible in the admin is invisible");
  console.log("here until it is published to that channel. Check Product > Publishing.");
  process.exit(1);
}

let problems = 0;
for (const p of products) {
  const v = p.variants.nodes[0];
  const m = v?.unitPriceMeasurement;
  const coverage = Number(m?.quantityValue ?? 0);
  const perSqFt = Number(v?.unitPrice?.amount ?? 0);
  const packPrice = Number(v?.price?.amount ?? 0);

  console.log(`── ${p.title}`);
  console.log(`   ${p.handle}   ${p.variants.nodes.length} variant(s)`);

  const rows = [
    ["product type (card eyebrow)", Boolean(p.productType), p.productType || "—"],
    ["sku", Boolean(v?.sku), v?.sku || "—"],
    ["image", Boolean(p.featuredImage), `${p.images.nodes.length} in gallery`],
    ["in stock", p.availableForSale, String(p.availableForSale)],
    ["pack price", packPrice > 0, rupees(packPrice)],
    ["unit price (per sq ft)", perSqFt > 0, perSqFt > 0 ? rupees(perSqFt) : "not configured"],
    ["coverage", coverage > 0, coverage > 0 ? `${coverage} ${m.quantityUnit} per pack` : "not configured"],
    ["pack unit", Boolean(v?.packUnit?.value), v?.packUnit?.value || "defaults to “box”"],
    ["pieces per pack", Boolean(v?.pieces?.value), v?.pieces?.value || "optional"],
    ["tags", p.tags.length > 0, p.tags.join(", ") || "—"],
  ];
  for (const [label, ok, detail] of rows) {
    console.log(`   [${tick(ok)}] ${label.padEnd(26)} ${detail}`);
  }

  // The two numbers the card and the calculator actually render.
  if (perSqFt > 0 && coverage > 0) {
    const area = 200;
    const boxes = Math.ceil((area * 1.1) / coverage);
    console.log(`   → card:       ${rupees(perSqFt)}/sq ft   ${rupees(packPrice)}/${v?.packUnit?.value ?? "box"}`);
    console.log(`   → calculator: ${area} sq ft +10% = ${boxes} boxes = ${rupees(boxes * packPrice)}`);
    console.log(`                 covers ${(boxes * coverage).toFixed(1)} sq ft`);
  } else {
    problems++;
    console.log("   → card falls back to the pack price with NO unit label (correct, but not the goal).");
    console.log("     Set the variant's unit price: quantity = sq ft per pack, unit = ft.");
  }
  console.log();
}

process.exit(problems > 0 ? 1 : 0);
