/**
 * Creates ONE product carrying ONE image, as a fixture for the gallery's hero layout.
 *
 *   node scripts/create-single-image-product.mjs           # create
 *   node scripts/create-single-image-product.mjs --delete  # remove it again
 *
 * WHY IT EXISTS. The desktop gallery is a two-column mosaic, so an odd number of images used to
 * leave the last cell empty -- and with a single image that meant half the gallery column showed
 * nothing at all. ProductGallery now spans the first image across both columns on an odd count, and
 * this is the product that proves it against real Shopify data rather than a hand-edited array.
 *
 * It is deliberately a DIFFERENT material from the two-image tile (a wallpaper roll, priced by the
 * roll rather than by the square foot) so it also exercises the no-coverage path: no unit price, so
 * the PDP shows a pack price, the calculator becomes a plain quantity stepper, and the Coverage
 * insight card drops out. Two fixtures, two pricing models.
 *
 * Everything else mirrors create-test-product.mjs -- same env loading, same publish-everywhere step,
 * same userErrors handling. Delete it when the layout work is done; nothing depends on it.
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
const HANDLE = "textured-wallpaper-chalk-single";
const CDN = "https://cdn.shopify.com/s/files/1/0778/7636/3401/files";

async function gql(query, variables = {}) {
  const r = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors));
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
  await gql(
    `mutation($id: ID!) { productDelete(input: {id: $id}) { deletedProductId userErrors { field message } } }`,
    { id: existing.id },
  );
  console.log("deleted:", existing.title);
  process.exit(0);
}

if (await find()) {
  console.log("already exists — run with --delete first to recreate");
  process.exit(0);
}

const { productCreate } = await gql(
  `mutation($input: ProductCreateInput!) {
     productCreate(product: $input) {
       product { id title handle variants(first: 1) { nodes { id } } }
       userErrors { field message }
     }
   }`,
  {
    input: {
      title: "Textured Wallpaper Chalk 10 m Roll",
      handle: HANDLE,
      productType: "Wallpaper",
      vendor: "Material",
      tags: ["New"],
      status: "ACTIVE",
      descriptionHtml:
        "<p>Plain textured non-woven wallpaper in chalk. Sold by the roll; " +
        "one roll covers approximately 10 m × 0.53 m.</p>",
    },
  },
);
const product = productCreate.product;
const variantId = product.variants.nodes[0].id;
console.log("created product:", product.handle);

// Priced by the ROLL, with NO unit price -- this is the no-coverage path on the PDP.
await gql(
  `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
     productVariantsBulkUpdate(productId: $productId, variants: $variants) {
       productVariants { id sku price }
       userErrors { field message }
     }
   }`,
  {
    productId: product.id,
    variants: [
      {
        id: variantId,
        price: "3200.00",
        compareAtPrice: "4100.00",
        inventoryItem: { sku: "WP 01184", tracked: true },
      },
    ],
  },
);
console.log("set price (by the roll, no unit price)");

// ONE image. The whole point of the fixture.
await gql(
  `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
     productCreateMedia(productId: $productId, media: $media) {
       media { alt } mediaUserErrors { field message }
     }
   }`,
  {
    productId: product.id,
    media: [
      {
        originalSource: `${CDN}/wallpaper.png?v=1786039458`,
        alt: "Chalk textured wallpaper hung in a bedroom",
        mediaContentType: "IMAGE",
      },
    ],
  },
);
console.log("attached 1 image");

// The spec metafields the PDP reads, so the insight cards have something to show. `pack_unit` is
// what makes the calculator say "rolls" rather than "boxes".
await gql(
  `mutation($metafields: [MetafieldsSetInput!]!) {
     metafieldsSet(metafields: $metafields) { userErrors { field message } }
   }`,
  {
    metafields: [
      { ownerId: product.id, namespace: "custom", key: "finish", type: "single_line_text_field", value: "Textured" },
      { ownerId: product.id, namespace: "custom", key: "material", type: "single_line_text_field", value: "Non-woven" },
      { ownerId: product.id, namespace: "custom", key: "look", type: "single_line_text_field", value: "Plain" },
      {
        ownerId: product.id,
        namespace: "custom",
        key: "application",
        type: "list.single_line_text_field",
        value: JSON.stringify(["Bedroom", "Living room"]),
      },
      { ownerId: variantId, namespace: "custom", key: "pack_unit", type: "single_line_text_field", value: "roll" },
    ],
  },
);
console.log("set spec metafields");

const { publications } = await gql(`{ publications(first: 25) { nodes { id name } } }`);
await gql(
  `mutation($id: ID!, $input: [PublicationInput!]!) {
     publishablePublish(id: $id, input: $input) { userErrors { field message } }
   }`,
  { id: product.id, input: publications.nodes.map((p) => ({ publicationId: p.id })) },
);
console.log("published to:", publications.nodes.map((p) => p.name).join(", "));

const { locations } = await gql(`{ locations(first: 1) { nodes { id name } } }`);
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
        quantities: [{ inventoryItemId, locationId: locations.nodes[0].id, quantity: 12 }],
      },
    },
  );
  console.log("stock set to 12 rolls at", locations.nodes[0].name);
}

console.log(`\nnow open:  /products/${HANDLE}`);
