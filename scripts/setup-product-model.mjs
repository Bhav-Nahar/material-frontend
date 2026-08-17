/**
 * Builds out the FULL product data model on the one test product, so we know what a Shopify
 * product can carry before any PDP is written. Everything Material Depot shows on a PDP, proven
 * readable through the Storefront API.
 *
 *   node scripts/setup-product-model.mjs
 *
 * Creates metafield definitions with PUBLIC_READ storefront access (without it the Storefront API
 * returns null rather than an error, which fails silently), fills them on the test product, and
 * adds a SECOND size variant so per-variant coverage is exercised rather than assumed.
 *
 * What is deliberately NOT a metafield:
 *   coverage      -> variant unit price (quantityValue), already proven
 *   category      -> productType
 *   sku / price   -> native variant fields
 *   size / colour -> product OPTIONS, so each combination is its own sellable variant
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
const TOKEN = env.SHOPIFY_ADMIN_TOKEN;
const VERSION = env.SHOPIFY_API_VERSION ?? "2026-01";
const HANDLE = "wood-floor-tile-nordic-honey-1200x200";

async function gql(query, variables = {}, { tolerate = [] } = {}) {
  const r = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors));
  for (const v of Object.values(j.data ?? {})) {
    const errs = v?.userErrors ?? v?.mediaUserErrors;
    const fatal = (errs ?? []).filter((e) => !tolerate.includes(e.code));
    if (fatal.length) throw new Error("userErrors: " + JSON.stringify(fatal));
  }
  return j.data;
}

/* ── 1. definitions ─────────────────────────────────────────────────────────────────────────── */

const DEFINITIONS = [
  // Variant-level: these differ per size, so they cannot live on the product.
  { ownerType: "PRODUCTVARIANT", key: "pieces_per_pack", name: "Pieces per pack", type: "number_integer",
    description: "Tiles in one box. Shown as “(6 Piece)” beside the box price." },
  { ownerType: "PRODUCTVARIANT", key: "pack_unit", name: "Pack unit", type: "single_line_text_field",
    description: "box / sheet / roll — names the pack on the price row." },
  { ownerType: "PRODUCTVARIANT", key: "thickness_mm", name: "Thickness (mm)", type: "number_decimal" },

  // Product-level specs. These drive the spec table and, later, PLP filters.
  { ownerType: "PRODUCT", key: "finish", name: "Finish", type: "single_line_text_field" },
  { ownerType: "PRODUCT", key: "material", name: "Material", type: "single_line_text_field" },
  { ownerType: "PRODUCT", key: "look", name: "Look", type: "single_line_text_field" },
  { ownerType: "PRODUCT", key: "application", name: "Application", type: "list.single_line_text_field",
    description: "Rooms/surfaces this suits — Living room, Bedroom, Kitchen." },
  { ownerType: "PRODUCT", key: "slip_rating", name: "Slip rating", type: "single_line_text_field" },

  // Long-form PDP content -- Material Depot runs these as tabs.
  { ownerType: "PRODUCT", key: "installation_guide", name: "Installation guide", type: "multi_line_text_field" },
  { ownerType: "PRODUCT", key: "care_maintenance", name: "Care & maintenance", type: "multi_line_text_field" },

  // Samples: a price, so the PDP can offer "Order a sample for ₹X".
  { ownerType: "PRODUCT", key: "sample_price", name: "Sample price", type: "number_decimal" },
];

console.log("creating metafield definitions…");
let created = 0, existed = 0;
for (const d of DEFINITIONS) {
  const data = await gql(
    `mutation($definition: MetafieldDefinitionInput!) {
       metafieldDefinitionCreate(definition: $definition) {
         createdDefinition { id key ownerType }
         userErrors { field message code }
       }
     }`,
    {
      definition: {
        ...d,
        namespace: "custom",
        // Without PUBLIC_READ the Storefront API silently returns null for every value.
        access: { storefront: "PUBLIC_READ" },
      },
    },
    { tolerate: ["TAKEN"] },
  );
  if (data.metafieldDefinitionCreate.createdDefinition) created++;
  else existed++;
}
console.log(`  ${created} created, ${existed} already existed`);

/* ── 2. a second size, to prove per-variant coverage ────────────────────────────────────────── */

const { productByIdentifier: product } = await gql(
  `query($h: String!) {
     productByIdentifier(identifier: {handle: $h}) {
       id options { id name optionValues { id name } }
       variants(first: 10) { nodes { id title selectedOptions { name value } } }
     }
   }`,
  { h: HANDLE },
);
if (!product) throw new Error(`product ${HANDLE} not found — run product:create first`);

console.log("\nvariants before:", product.variants.nodes.length);

// Rename the default option to "Size" so the second variant is a real, selectable choice.
const opt = product.options[0];
if (opt.name !== "Size") {
  await gql(
    `mutation($productId: ID!, $option: OptionUpdateInput!, $values: [OptionValueUpdateInput!]) {
       productOptionUpdate(productId: $productId, option: $option, optionValuesToUpdate: $values) {
         userErrors { field message }
       }
     }`,
    {
      productId: product.id,
      option: { id: opt.id, name: "Size" },
      values: [{ id: opt.optionValues[0].id, name: "1200 × 200 mm" }],
    },
  );
  console.log('  renamed option to "Size" / "1200 × 200 mm"');
}

const hasSecond = product.variants.nodes.some((v) => /600/.test(v.title));
if (!hasSecond) {
  await gql(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
       productVariantsBulkCreate(productId: $productId, variants: $variants) {
         productVariants { id title }
         userErrors { field message }
       }
     }`,
    {
      productId: product.id,
      variants: [
        {
          optionValues: [{ optionName: "Size", name: "600 × 600 mm" }],
          price: "1180.00",
          compareAtPrice: "1512.00",
          inventoryItem: { sku: "TL 06117-600", tracked: true },
          showUnitPrice: true,
          // A different size covers a different area -- the whole point of per-variant coverage.
          unitPriceMeasurement: { quantityValue: 14.4, quantityUnit: "FT2", referenceValue: 1, referenceUnit: "FT2" },
        },
      ],
    },
  );
  console.log("  added second variant: 600 × 600 mm, ₹1,180/box covering 14.4 sq ft");
}

/* ── 3. values ──────────────────────────────────────────────────────────────────────────────── */

const { productByIdentifier: fresh } = await gql(
  `query($h: String!) {
     productByIdentifier(identifier: {handle: $h}) {
       id variants(first: 10) { nodes { id title } }
     }
   }`,
  { h: HANDLE },
);

const productMetafields = [
  { key: "finish", type: "single_line_text_field", value: "Matte" },
  { key: "material", type: "single_line_text_field", value: "Vitrified" },
  { key: "look", type: "single_line_text_field", value: "Wood" },
  { key: "application", type: "list.single_line_text_field", value: JSON.stringify(["Living room", "Bedroom", "Kitchen"]) },
  { key: "slip_rating", type: "single_line_text_field", value: "R10" },
  { key: "sample_price", type: "number_decimal", value: "308" },
  { key: "installation_guide", type: "multi_line_text_field",
    value: "A 2–3 mm spacer is mandatory.\nLay on a level, cured screed.\nDry-lay one box first to check the random pattern falls well." },
  { key: "care_maintenance", type: "multi_line_text_field",
    value: "Sweep loose grit before mopping.\nUse a pH-neutral cleaner; avoid acids on the grout.\nNo sealing required." },
].map((m) => ({ ...m, namespace: "custom", ownerId: fresh.id }));

const variantMetafields = fresh.variants.nodes.flatMap((v) => {
  const small = /600 × 600/.test(v.title);
  return [
    { key: "pieces_per_pack", type: "number_integer", value: small ? "4" : "6" },
    { key: "pack_unit", type: "single_line_text_field", value: "box" },
    { key: "thickness_mm", type: "number_decimal", value: "9" },
  ].map((m) => ({ ...m, namespace: "custom", ownerId: v.id }));
});

await gql(
  `mutation($metafields: [MetafieldsSetInput!]!) {
     metafieldsSet(metafields: $metafields) { metafields { key } userErrors { field message } }
   }`,
  { metafields: [...productMetafields, ...variantMetafields] },
);
console.log(`\nset ${productMetafields.length} product + ${variantMetafields.length} variant metafields`);
console.log("\nnow run:  node scripts/verify-product-model.mjs");
