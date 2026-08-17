/**
 * Reads the full product model through the STOREFRONT API -- the one the site actually uses --
 * and renders what a PDP could show. Admin having the data proves nothing; a metafield definition
 * without PUBLIC_READ returns null here rather than an error, so this is the check that counts.
 *
 *   node scripts/verify-product-model.mjs
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

const QUERY = `
  query PDP($handle: String!) {
    product(handle: $handle) {
      title
      productType
      tags
      descriptionHtml
      options { name optionValues { name } }
      finish:      metafield(namespace: "custom", key: "finish") { value }
      material:    metafield(namespace: "custom", key: "material") { value }
      look:        metafield(namespace: "custom", key: "look") { value }
      application: metafield(namespace: "custom", key: "application") { value }
      slip:        metafield(namespace: "custom", key: "slip_rating") { value }
      samplePrice: metafield(namespace: "custom", key: "sample_price") { value }
      install:     metafield(namespace: "custom", key: "installation_guide") { value }
      care:        metafield(namespace: "custom", key: "care_maintenance") { value }
      images(first: 10) { nodes { url } }
      variants(first: 10) {
        nodes {
          id
          title
          sku
          availableForSale
          selectedOptions { name value }
          price { amount }
          compareAtPrice { amount }
          unitPrice { amount }
          unitPriceMeasurement { quantityValue referenceUnit }
          pieces:    metafield(namespace: "custom", key: "pieces_per_pack") { value }
          packUnit:  metafield(namespace: "custom", key: "pack_unit") { value }
          thickness: metafield(namespace: "custom", key: "thickness_mm") { value }
        }
      }
    }
  }
`;

const res = await fetch(
  `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query: QUERY, variables: { handle: "wood-floor-tile-nordic-honey-1200x200" } }),
  },
);
const { data, errors } = await res.json();
if (errors) {
  console.error(JSON.stringify(errors, null, 1));
  process.exit(1);
}
const p = data?.product;
if (!p) {
  console.error("product not visible to the Storefront API");
  process.exit(1);
}

const money = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
const mark = (v) => (v ? "ok  " : "MISS");
let missing = 0;
const check = (label, value, render = (v) => v) => {
  if (!value) missing++;
  console.log(`  [${mark(value)}] ${label.padEnd(20)} ${value ? render(value) : "—"}`);
};

console.log(`\n${p.title}`);
console.log("─".repeat(64));
console.log("PRODUCT");
check("productType", p.productType);
check("tags", p.tags.length ? p.tags.join(", ") : null);
check("images", p.images.nodes.length ? `${p.images.nodes.length}` : null);
check("options", p.options.map((o) => `${o.name}: ${o.optionValues.map((v) => v.name).join(" / ")}`).join(" · "));
check("finish", p.finish?.value);
check("material", p.material?.value);
check("look", p.look?.value);
check("application", p.application?.value, (v) => JSON.parse(v).join(", "));
check("slip rating", p.slip?.value);
check("sample price", p.samplePrice?.value, money);
check("installation guide", p.install?.value, (v) => `${v.split("\n").length} lines`);
check("care & maintenance", p.care?.value, (v) => `${v.split("\n").length} lines`);

console.log("\nVARIANTS");
for (const v of p.variants.nodes) {
  const coverage = Number(v.unitPriceMeasurement?.quantityValue ?? 0);
  const perSqFt = Number(v.unitPrice?.amount ?? 0);
  const pack = Number(v.price.amount);
  console.log(`\n  ${v.title}   ${v.sku ?? "no sku"}   ${v.availableForSale ? "in stock" : "out of stock"}`);
  check("  coverage", coverage ? `${coverage} ${v.unitPriceMeasurement.referenceUnit}` : null);
  check("  per sq ft", perSqFt ? money(perSqFt) : null);
  check("  pack price", money(pack));
  check("  pieces/pack", v.pieces?.value);
  check("  pack unit", v.packUnit?.value);
  check("  thickness", v.thickness?.value, (x) => `${x} mm`);

  if (coverage && perSqFt) {
    const area = 200;
    const boxes = Math.ceil((area * 1.1) / coverage);
    console.log(`     → ${money(perSqFt)}/sq ft · ${money(pack)}/${v.packUnit?.value ?? "box"}` +
                (v.pieces?.value ? ` (${v.pieces.value} Piece)` : ""));
    console.log(`     → ${area} sq ft +10% = ${boxes} ${v.packUnit?.value ?? "box"}es = ${money(boxes * pack)}` +
                `, covers ${(boxes * coverage).toFixed(1)} sq ft`);
  }
}

console.log("\n" + "─".repeat(64));
console.log(missing === 0 ? "every PDP field readable from the Storefront API" : `${missing} field(s) missing`);
process.exit(missing === 0 ? 0 : 1);
