/**
 * Creates ONE test product to prove the per-square-foot pricing model end to end.
 *
 *   node scripts/create-test-product.mjs           # create
 *   node scripts/create-test-product.mjs --delete  # remove it again
 *
 * Values mirror a real Material Depot tile so the arithmetic can be checked against a known
 * answer: ₹1,844.50 a box covering 15.5 sq ft => ₹119.00/sq ft, and 200 sq ft + 10% = 15 boxes.
 *
 * Unit price is set to FT2 -- the true unit. The Shopify ADMIN UI only offers imperial length
 * ("ft"), but the Admin API accepts FT2, so setting it here avoids storing square feet mislabelled
 * as feet. Anything reading the field afterwards (order emails, Google Merchant feeds) is correct.
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
const CDN = "https://cdn.shopify.com/s/files/1/0778/7636/3401/files";

async function gql(query, variables = {}) {
  const r = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors));
  // Every Shopify mutation reports its own failures in userErrors rather than throwing.
  for (const v of Object.values(j.data ?? {})) {
    const errs = v?.userErrors ?? v?.mediaUserErrors;
    if (errs?.length) throw new Error("userErrors: " + JSON.stringify(errs));
  }
  return j.data;
}

const find = async () => {
  const d = await gql(
    `query($h: String!) { productByIdentifier(identifier: {handle: $h}) { id title } }`,
    { h: HANDLE },
  );
  return d.productByIdentifier;
};

if (process.argv.includes("--delete")) {
  const existing = await find();
  if (!existing) {
    console.log("nothing to delete");
    process.exit(0);
  }
  await gql(`mutation($id: ID!) { productDelete(input: {id: $id}) { deletedProductId userErrors { field message } } }`, {
    id: existing.id,
  });
  console.log("deleted:", existing.title);
  process.exit(0);
}

if (await find()) {
  console.log("already exists — run with --delete first to recreate");
  process.exit(0);
}

// 1. the product shell
const { productCreate } = await gql(
  `mutation($input: ProductCreateInput!) {
     productCreate(product: $input) {
       product { id title handle variants(first: 1) { nodes { id } } }
       userErrors { field message }
     }
   }`,
  {
    input: {
      title: "Wood Floor Tile Nordic Honey 1200 × 200 mm",
      handle: HANDLE,
      productType: "Floor tiles",
      vendor: "Material",
      tags: ["Bestseller"],
      status: "ACTIVE",
      descriptionHtml:
        "<p>Vitrified matte wood-look floor tile, 9 mm. Sold by the box; " +
        "one box covers 15.5 sq ft (6 pieces).</p>",
    },
  },
);
const product = productCreate.product;
const variantId = product.variants.nodes[0].id;
console.log("created product:", product.handle);

// 2. price, sku, and the unit price that drives everything downstream
await gql(
  `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
     productVariantsBulkUpdate(productId: $productId, variants: $variants) {
       productVariants {
         id sku price compareAtPrice
         unitPrice { amount }
         unitPriceMeasurement { quantityValue quantityUnit referenceValue referenceUnit }
       }
       userErrors { field message }
     }
   }`,
  {
    productId: product.id,
    variants: [
      {
        id: variantId,
        price: "1844.50",
        compareAtPrice: "3173.78",
        inventoryItem: { sku: "TL 06117", tracked: true, measurement: { weight: { value: 28, unit: "KILOGRAMS" } } },
        showUnitPrice: true,
        unitPriceMeasurement: {
          quantityValue: 15.5,
          quantityUnit: "FT2",
          referenceValue: 1,
          referenceUnit: "FT2",
        },
      },
    ],
  },
);
console.log("set price + unit price");

// 3. images -- two, so the card's image gallery has something to scroll
await gql(
  `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
     productCreateMedia(productId: $productId, media: $media) {
       media { alt } mediaUserErrors { field message }
     }
   }`,
  {
    productId: product.id,
    media: [
      { originalSource: `${CDN}/tiles.png?v=1786039457`, alt: "Nordic honey wood-look floor tile laid in a living room", mediaContentType: "IMAGE" },
      { originalSource: `${CDN}/Laminates.png?v=1786039520`, alt: "Nordic honey plank detail", mediaContentType: "IMAGE" },
    ],
  },
);
console.log("attached 2 images");

// 4. publish everywhere, so the Storefront API token can see it at all
const { publications } = await gql(`{ publications(first: 25) { nodes { id name } } }`);
await gql(
  `mutation($id: ID!, $input: [PublicationInput!]!) {
     publishablePublish(id: $id, input: $input) { userErrors { field message } }
   }`,
  { id: product.id, input: publications.nodes.map((p) => ({ publicationId: p.id })) },
);
console.log("published to:", publications.nodes.map((p) => p.name).join(", "));

// 5. stock
const { locations } = await gql(`{ locations(first: 1) { nodes { id name } } }`);
// Fetch the variant directly by id -- productVariants(query:) takes a search String, not an ID.
const { productVariant } = await gql(
  `query($id: ID!) { productVariant(id: $id) { inventoryItem { id } } }`,
  { id: variantId },
);
const inventoryItemId = productVariant?.inventoryItem?.id;
if (inventoryItemId) {
  await gql(
    `mutation($input: InventorySetQuantitiesInput!) {
       inventorySetQuantities(input: $input) { userErrors { field message } }
     }`,
    {
      input: {
        name: "available",
        reason: "correction",
        ignoreCompareQuantity: true,
        quantities: [{ inventoryItemId, locationId: locations.nodes[0].id, quantity: 40 }],
      },
    },
  );
  console.log("stock set to 40 boxes at", locations.nodes[0].name);
}

console.log("\nnow run:  npm run verify:product");
