/**
 * Creates TEN real products in Shopify to stress-test the PDP at both extremes and in the middle.
 *
 *   node scripts/create-stress-products.mjs           # create
 *   node scripts/create-stress-products.mjs --delete  # remove all ten (and the collections it made)
 *
 * Every handle is prefixed `fx-`, and --delete removes exactly those, so this can never touch a real
 * product. Needs a live Admin token: run `node scripts/shopify-token.mjs --write` first, the
 * client_credentials grant only lasts 24h.
 *
 * WHAT IS BEING STRESSED. The PDP's layout turns on a handful of counts, and each is pushed to both
 * ends rather than left at the comfortable middle:
 *
 *   images        0, 1, 2, 3, 4, 5, 12    -- the gallery spans image 1 across both columns on ODD counts
 *   variants      1, 2, 8, 12             -- one hides the picker; twelve makes a long two-column grid
 *   options       none, Size, Size+Finish -- the picker's legend reads "Size / Finish" on two
 *   pricing       per sq ft vs per pack   -- no coverage means a quantity stepper, not an area field
 *   spec fields   all 8, 3, 0             -- insight cards drop out one by one; under two the grid goes
 *   stock         plenty, 4 left, none, untracked
 *   price         ₹120 to ₹4,12,500       -- formatting, and truncation in the pinned bar
 *   text          "Unnamed Tile" to a 20-word title, 8 rooms, a 9-step installation guide
 *
 * Nine of the ten also land in a collection, which is the first time the PDP's "More from …" rail and
 * the recently-viewed rail have had anything to show.
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
const CDN = "https://cdn.shopify.com/s/files/1/0778/7636/3401/files";

// The three photographs the project already ships, cycled. A distinct query param per slot means a
// gallery of twelve is twelve separate media records without twelve real uploads.
const PHOTOS = [
  `${CDN}/tiles.png?v=1786039457`,
  `${CDN}/Laminates.png?v=1786039520`,
  `${CDN}/wallpaper.png?v=1786039458`,
];

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

/* ------------------------------------------------------------------ the ten products */

const LONG_INSTALL = [
  "Let the tiles acclimatise in the room for 24 hours before laying.",
  "Check the sub-floor is level to within 3 mm over 2 m; skim it if it is not.",
  "Dry-lay one full box to confirm the shade blend before any adhesive is mixed.",
  "Use a C2TE class cement adhesive, notched 10 mm.",
  "Back-butter planks longer than 900 mm on the long edge.",
  "Keep a 2 mm joint; a butt joint will telegraph every sub-floor movement.",
  "Stagger end joints by at least a third of a plank length.",
  "Leave a 6 mm perimeter gap at every wall and cover it with skirting.",
  "Grout after 24 hours and keep foot traffic off for a further 24.",
].join("\n");

const LONG_CARE = [
  "Sweep or vacuum before mopping — grit underfoot does more damage than any cleaner.",
  "Mop with a pH-neutral floor cleaner; nothing acidic, nothing with wax in it.",
  "Wipe spills of oil, wine or turmeric the same day.",
  "Never use a steel scourer or scouring powder on a matte surface.",
  "Re-seal the grout, not the tile, once a year in wet areas.",
].join("\n");

/** coverage>0 gives Shopify a unit price, which is what puts an AREA field on the PDP. */
const v = (o) => ({ stock: null, inStock: true, packUnit: "box", ...o });

const PRODUCTS = [
  {
    // ---------------------------------------------------------- 1. the ordinary middle
    handle: "fx-mid-kitchen-tile",
    title: "Ceramic Kitchen Wall Tile Chalk White 300 × 600 mm",
    productType: "Wall tiles",
    tags: ["Bestseller"],
    images: 3,
    collection: "tiles",
    description:
      "Glazed ceramic wall tile in a soft chalk white. Sold by the box; one box covers 12.9 sq ft (8 pieces).",
    specs: { finish: "Glossy", material: "Ceramic", look: "Solid colour", slip_rating: "R9", application: ["Kitchen", "Bathroom"] },
    installation: LONG_INSTALL.split("\n").slice(0, 4).join("\n"),
    care: LONG_CARE.split("\n").slice(0, 3).join("\n"),
    samplePrice: 99,
    optionName: "Size",
    variants: [
      v({ opt: "300 × 600 mm", sku: "FX WT30601", price: "968.00", compare: "1180.00", coverage: 12.9, pieces: 8, thickness: 8, stock: 120 }),
      v({ opt: "600 × 600 mm", sku: "FX WT60601", price: "1420.00", compare: "1740.00", coverage: 15.5, pieces: 4, thickness: 9, stock: 64 }),
    ],
  },
  {
    // ------------------------------------- 2. ONE image, ONE variant, priced by the pack
    handle: "fx-single-image-roll",
    title: "Textured Wallpaper Chalk 10 m Roll",
    productType: "Wallpaper",
    tags: ["New"],
    images: 1,
    collection: "wallpaper",
    description: "Plain textured non-woven wallpaper. Sold by the roll; one roll covers about 10 m × 0.53 m.",
    specs: { finish: "Textured", material: "Non-woven", application: ["Bedroom", "Living room"] },
    care: LONG_CARE.split("\n").slice(0, 2).join("\n"),
    samplePrice: 99,
    variants: [v({ sku: "FX WP01184", price: "3200.00", compare: "4100.00", packUnit: "roll", stock: 12 })],
  },
  {
    // ------------------------------------------------ 3. EXTREME HIGH: everything at once
    handle: "fx-max-everything",
    title:
      "Italian Rectified Glazed Vitrified Double-Charge Wood-Look Plank Floor Tile in Smoked Walnut 1200 × 200 mm",
    productType: "Floor tiles",
    vendor: "Casa Ceramiche",
    tags: ["Trending", "Limited stock"],
    images: 12,
    collection: "tiles",
    description: LONG_INSTALL.replaceAll("\n", " "),
    specs: {
      finish: "Matte",
      material: "Vitrified",
      look: "Wood",
      slip_rating: "R11",
      application: ["Living room", "Bedroom", "Kitchen", "Bathroom", "Balcony", "Terrace", "Staircase", "Office"],
    },
    installation: LONG_INSTALL,
    care: LONG_CARE,
    samplePrice: 149,
    // TWO options, so the picker's legend reads "Size / Finish" and titles are "1200 × 200 mm / Smoked".
    options: [
      { name: "Size", values: ["1200 × 200 mm", "900 × 150 mm", "800 × 200 mm", "600 × 100 mm"] },
      { name: "Finish", values: ["Smoked", "Honey", "Ash"] },
    ],
    // Stock of 4 everywhere, so both the "only N left" and the "you asked for more than we hold" notes fire.
    variantFrom: (size, finish, i) =>
      v({ sku: `FX FL${4100 + i}`, price: `${2480 - i * 60}.00`, compare: `${6520 - i * 60}.00`, coverage: Math.round((15.5 - i * 0.4) * 10) / 10, pieces: 6, thickness: 9, stock: 4 }),
  },
  {
    // -------------------------------- 4. EXTREME LOW: nothing filled in except one price
    handle: "fx-bare-minimum",
    title: "Unnamed Tile",
    productType: "",
    vendor: "",
    tags: [],
    images: 1,
    collection: null,
    description: "",
    specs: {},
    // Untracked inventory, so quantityAvailable comes back null -- the "not saying" stock path.
    variants: [v({ price: "120.00", tracked: false })],
  },
  {
    // ----------------------------------------------------------- 5. NO images at all
    handle: "fx-no-images",
    title: "Terrazzo Look Floor Tile Speckled Grey 600 × 600 mm",
    productType: "Floor tiles",
    tags: [],
    images: 0,
    collection: "tiles",
    description: "A product whose photography has not been shot yet.",
    specs: { finish: "Matte", material: "Vitrified", look: "Terrazzo", application: ["Living room"] },
    optionName: "Size",
    variants: [
      v({ opt: "600 × 600 mm", sku: "FX FL60060", price: "1640.00", coverage: 15.5, pieces: 4, thickness: 9, stock: 40 }),
      v({ opt: "800 × 800 mm", sku: "FX FL80080", price: "2380.00", coverage: 17.2, pieces: 3, thickness: 10, stock: 22 }),
    ],
  },
  {
    // ------------------------------------------------------ 6. entirely MADE TO ORDER
    handle: "fx-made-to-order",
    title: "Handmade Zellige Wall Tile Emerald 100 × 100 mm",
    productType: "Wall tiles",
    vendor: "Atelier Fes",
    tags: ["Made to order"],
    images: 5,
    collection: "tiles",
    description: "Hand-dipped zellige, fired in small batches. Every tile varies; that is the point.",
    specs: { finish: "Glossy", material: "Terracotta", look: "Zellige", application: ["Kitchen", "Bathroom"] },
    installation: LONG_INSTALL.split("\n").slice(0, 6).join("\n"),
    samplePrice: 199,
    optionName: "Size",
    variants: [
      v({ opt: "100 × 100 mm", sku: "FX ZL10010", price: "4850.00", coverage: 10.7, pieces: 100, thickness: 11, stock: 0 }),
      v({ opt: "50 × 50 mm", sku: "FX ZL05005", price: "5240.00", coverage: 9.8, pieces: 200, thickness: 11, stock: 0 }),
    ],
  },
  {
    // -------------------------------------------------------- 7. LOW stock, single size
    handle: "fx-low-stock",
    title: "Fluted Wall Panel Oak 2400 × 300 mm",
    productType: "Wall panels",
    tags: ["Almost gone"],
    images: 2,
    collection: "tiles",
    description: "MDF fluted panel with an oak veneer. Sold by the panel.",
    specs: { finish: "Satin", material: "MDF", look: "Fluted", application: ["Living room", "Bedroom"] },
    care: LONG_CARE.split("\n").slice(0, 2).join("\n"),
    variants: [
      v({ sku: "FX FP24030", price: "2190.00", compare: "2790.00", coverage: 7.75, packUnit: "panel", thickness: 12, stock: 4 }),
    ],
  },
  {
    // --------------------------------------- 8. EIGHT variants with very long option names
    handle: "fx-long-variant-names",
    title: "Decorative Laminate Sheet 8 ft × 4 ft",
    productType: "Laminates",
    images: 4,
    collection: "laminates",
    description: "One-millimetre decorative laminate, sold by the sheet.",
    specs: { finish: "Suede", material: "Laminate", look: "Woodgrain", application: ["Wardrobe", "Kitchen"] },
    samplePrice: 99,
    optionName: "Decor",
    variants: [
      "Smoked Walnut Horizontal Grain",
      "Natural Teak Vertical Grain",
      "Frosted Oak Cross Grain",
      "Charcoal Ash Straight Grain",
      "Honey Maple Rustic Grain",
      "Bleached Birch Fine Grain",
      "Wenge Dark Straight Grain",
      "Rosewood Deep Figured Grain",
    ].map((opt, i) =>
      v({ opt, sku: `FX LM${2100 + i}`, price: `${1980 + i * 45}.00`, compare: `${2480 + i * 45}.00`, packUnit: "sheet", thickness: 1, stock: 30 - i }),
    ),
  },
  {
    // ---------------------------------------------- 9. very LARGE prices, no compare-at
    handle: "fx-premium-marble",
    title: "Statuario Marble Slab Bookmatched 3200 × 1600 mm",
    productType: "Natural stone",
    vendor: "Cave di Carrara",
    tags: ["Rare"],
    images: 5,
    collection: "stone",
    description: "Bookmatched Statuario, sold as a matched pair of slabs. Priced per slab.",
    specs: { finish: "Polished", material: "Marble", look: "Marble", slip_rating: "R9", application: ["Living room", "Bathroom"] },
    installation: LONG_INSTALL.split("\n").slice(0, 5).join("\n"),
    care: LONG_CARE,
    samplePrice: 499,
    optionName: "Thickness",
    variants: [
      v({ opt: "18 mm", sku: "FX ST32160", price: "245000.00", coverage: 55.1, packUnit: "slab", thickness: 18, stock: 3 }),
      v({ opt: "30 mm", sku: "FX ST32163", price: "412500.00", coverage: 55.1, packUnit: "slab", thickness: 30, stock: 1 }),
    ],
  },
  {
    // ------------------------------- 10. pack-priced, many rooms, two images, big discount
    handle: "fx-mosaic-mid",
    title: "Glass Mosaic Sheet Sea Green 300 × 300 mm",
    productType: "Mosaic",
    tags: ["Deal"],
    images: 2,
    collection: "tiles",
    description: "Glass mosaic on a mesh backing. Sold by the sheet; cut the mesh to fit.",
    specs: {
      finish: "Glossy",
      material: "Glass",
      look: "Mosaic",
      slip_rating: "R10",
      application: ["Bathroom", "Kitchen", "Balcony", "Pool", "Utility"],
    },
    installation: LONG_INSTALL.split("\n").slice(0, 3).join("\n"),
    care: LONG_CARE.split("\n").slice(0, 4).join("\n"),
    samplePrice: 99,
    variants: [
      v({ sku: "FX MO30030", price: "640.00", compare: "1820.00", pieces: 1, packUnit: "sheet", thickness: 4, stock: 200 }),
    ],
  },
];

/* ---------------------------------------------------------------------------- delete */

const findProduct = async (handle) => {
  const d = await gql(
    `query($h: String!) { productByIdentifier(identifier: {handle: $h}) { id title } }`,
    { h: handle },
  );
  return d.productByIdentifier;
};

if (process.argv.includes("--delete")) {
  for (const p of PRODUCTS) {
    const existing = await findProduct(p.handle);
    if (!existing) continue;
    await gql(`mutation($id: ID!) { productDelete(input: {id: $id}) { deletedProductId userErrors { field message } } }`, {
      id: existing.id,
    });
    console.log("deleted", p.handle);
  }
  // The three collections this script creates. `tiles` is the shop's own and is left alone.
  for (const handle of ["wallpaper", "laminates", "stone"]) {
    const d = await gql(`query($q: String!) { collections(first: 1, query: $q) { nodes { id handle } } }`, {
      q: `handle:${handle}`,
    });
    const c = d.collections.nodes[0];
    if (!c) continue;
    await gql(`mutation($id: ID!) { collectionDelete(input: {id: $id}) { deletedCollectionId userErrors { field message } } }`, {
      id: c.id,
    });
    console.log("deleted collection", handle);
  }
  console.log("\ndone");
  process.exit(0);
}

/* ---------------------------------------------------------------------------- create */

const { publications } = await gql(`{ publications(first: 25) { nodes { id name } } }`);
const PUBS = publications.nodes.map((p) => ({ publicationId: p.id }));
const { locations } = await gql(`{ locations(first: 1) { nodes { id name } } }`);
const LOCATION = locations.nodes[0].id;

/** Collections are created on demand so breadcrumbs and the "More from …" rail have somewhere to point. */
const collectionCache = {};
async function collectionId(handle) {
  if (!handle) return null;
  if (collectionCache[handle]) return collectionCache[handle];
  const found = await gql(`query($q: String!) { collections(first: 1, query: $q) { nodes { id handle } } }`, {
    q: `handle:${handle}`,
  });
  let id = found.collections.nodes[0]?.id;
  if (!id) {
    const title = handle[0].toUpperCase() + handle.slice(1);
    const made = await gql(
      `mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { field message } } }`,
      { input: { title, handle } },
    );
    id = made.collectionCreate.collection.id;
    await gql(`mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, {
      id,
      input: PUBS,
    });
    console.log("  created collection", handle);
  }
  collectionCache[handle] = id;
  return id;
}

/** The variant fields Shopify needs, from one of our compact specs. */
function variantInput(spec, optionValues) {
  const input = {
    price: spec.price,
    ...(spec.compare && { compareAtPrice: spec.compare }),
    inventoryItem: { sku: spec.sku ?? null, tracked: spec.tracked !== false },
    ...(optionValues && { optionValues }),
  };
  // A unit price is what makes the PDP show ₹/sq ft and offer an AREA field instead of a bare stepper.
  if (spec.coverage) {
    input.showUnitPrice = true;
    input.unitPriceMeasurement = {
      quantityValue: spec.coverage,
      quantityUnit: "FT2",
      referenceValue: 1,
      referenceUnit: "FT2",
    };
  }
  return input;
}

/** Expand a two-option product into its full grid of combinations. */
function expand(p) {
  if (!p.options) return p.variants.map((s, i) => ({ spec: s, opts: p.optionName ? { [p.optionName]: s.opt } : null, i }));
  const [a, b] = p.options;
  const out = [];
  let i = 0;
  for (const av of a.values) for (const bv of b.values) out.push({ spec: p.variantFrom(av, bv, i), opts: { [a.name]: av, [b.name]: bv }, i: i++ });
  return out;
}

for (const p of PRODUCTS) {
  if (await findProduct(p.handle)) {
    console.log("skip (exists)", p.handle);
    continue;
  }

  const rows = expand(p);
  const multi = rows.length > 1;

  const productOptions = multi
    ? (p.options ?? [{ name: p.optionName, values: p.variants.map((s) => s.opt) }]).map((o) => ({
        name: o.name,
        values: o.values.map((name) => ({ name })),
      }))
    : undefined;

  const { productCreate } = await gql(
    `mutation($input: ProductCreateInput!) {
       productCreate(product: $input) {
         product { id handle variants(first: 1) { nodes { id selectedOptions { name value } } } }
         userErrors { field message }
       }
     }`,
    {
      input: {
        title: p.title,
        handle: p.handle,
        productType: p.productType || null,
        vendor: p.vendor === "" ? null : (p.vendor ?? "Material"),
        tags: p.tags,
        status: "ACTIVE",
        descriptionHtml: p.description ? `<p>${p.description}</p>` : "",
        ...(productOptions && { productOptions }),
      },
    },
  );
  const product = productCreate.product;
  const first = product.variants.nodes[0];

  // productCreate makes ONE variant (the first option combination). The rest are created here; the
  // first is matched by its option values and updated in place.
  const key = (opts) => (opts ? Object.values(opts).join(" / ") : "");
  const firstKey = first.selectedOptions.map((o) => o.value).join(" / ");
  const firstRow = multi ? rows.find((r) => key(r.opts) === firstKey) ?? rows[0] : rows[0];
  const rest = rows.filter((r) => r !== firstRow);

  await gql(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
       productVariantsBulkUpdate(productId: $productId, variants: $variants) {
         productVariants { id } userErrors { field message }
       }
     }`,
    { productId: product.id, variants: [{ id: first.id, ...variantInput(firstRow.spec) }] },
  );

  if (rest.length) {
    await gql(
      `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
         productVariantsBulkCreate(productId: $productId, variants: $variants) {
           productVariants { id } userErrors { field message }
         }
       }`,
      {
        productId: product.id,
        variants: rest.map((r) =>
          variantInput(
            r.spec,
            Object.entries(r.opts).map(([optionName, name]) => ({ optionName, name })),
          ),
        ),
      },
    );
  }

  // Images. 0 is a deliberate case, so this is skipped rather than defaulted.
  if (p.images > 0) {
    await gql(
      `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
         productCreateMedia(productId: $productId, media: $media) { media { alt } mediaUserErrors { field message } }
       }`,
      {
        productId: product.id,
        media: Array.from({ length: p.images }, (_, i) => ({
          originalSource: `${PHOTOS[i % PHOTOS.length]}&fx=${i}`,
          alt: i === 0 ? p.title : "",
          mediaContentType: "IMAGE",
        })),
      },
    );
  }

  // Product metafields, then per-variant ones. Types come from the store's own definitions --
  // see the probe in the commit message: sample_price is number_decimal, thickness_mm likewise.
  const metafields = [];
  const S = p.specs ?? {};
  for (const key of ["finish", "material", "look", "slip_rating"]) {
    if (S[key]) metafields.push({ ownerId: product.id, namespace: "custom", key, type: "single_line_text_field", value: S[key] });
  }
  if (S.application?.length) {
    metafields.push({ ownerId: product.id, namespace: "custom", key: "application", type: "list.single_line_text_field", value: JSON.stringify(S.application) });
  }
  if (p.installation) metafields.push({ ownerId: product.id, namespace: "custom", key: "installation_guide", type: "multi_line_text_field", value: p.installation });
  if (p.care) metafields.push({ ownerId: product.id, namespace: "custom", key: "care_maintenance", type: "multi_line_text_field", value: p.care });
  if (p.samplePrice) metafields.push({ ownerId: product.id, namespace: "custom", key: "sample_price", type: "number_decimal", value: String(p.samplePrice) });

  const { product: withVariants } = await gql(
    `query($id: ID!) {
       product(id: $id) { variants(first: 30) { nodes { id title inventoryItem { id } } } }
     }`,
    { id: product.id },
  );
  const nodes = withVariants.variants.nodes;

  // Match created variants back to our specs by option title so pack_unit and thickness land on the
  // right one. Single-variant products have the one node.
  const specFor = (title) =>
    multi ? (rows.find((r) => key(r.opts) === title)?.spec ?? rows[0].spec) : rows[0].spec;

  for (const node of nodes) {
    const s = specFor(node.title);
    if (s.pieces) metafields.push({ ownerId: node.id, namespace: "custom", key: "pieces_per_pack", type: "number_integer", value: String(s.pieces) });
    if (s.packUnit) metafields.push({ ownerId: node.id, namespace: "custom", key: "pack_unit", type: "single_line_text_field", value: s.packUnit });
    if (s.thickness) metafields.push({ ownerId: node.id, namespace: "custom", key: "thickness_mm", type: "number_decimal", value: String(s.thickness) });
  }

  // metafieldsSet takes 25 at a time.
  for (let i = 0; i < metafields.length; i += 25) {
    await gql(
      `mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { field message } } }`,
      { metafields: metafields.slice(i, i + 25) },
    );
  }

  await gql(`mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, {
    id: product.id,
    input: PUBS,
  });

  // Inventory. inventoryActivate rather than inventorySetQuantities: a variant created by
  // productVariantsBulkCreate is not yet STOCKED at any location, and setting a quantity there fails
  // with "inventory item is not stocked at the location". Activate does both in one call.
  //
  // Untracked variants are skipped on purpose -- that is the "stock not stated" case, where Shopify
  // reports quantityAvailable as null and the PDP must say nothing about stock at all.
  for (const node of nodes) {
    const s = specFor(node.title);
    if (s.tracked === false || s.stock === null) continue;
    await gql(
      `mutation($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
         inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
           inventoryLevel { id } userErrors { field message }
         }
       }`,
      { inventoryItemId: node.inventoryItem.id, locationId: LOCATION, available: s.stock },
    );
  }

  const cid = await collectionId(p.collection);
  if (cid) {
    await gql(
      `mutation($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } } }`,
      { id: cid, productIds: [product.id] },
    );
  }

  console.log(
    `created ${p.handle.padEnd(24)} ${String(nodes.length).padStart(2)} variants  ${String(p.images).padStart(2)} images  ${p.collection ?? "(no collection)"}`,
  );
}

console.log("\nall ten created. Media processing is async, so give it a few seconds, then:");
console.log("  npm run verify:product");
for (const p of PRODUCTS) console.log(`  /products/${p.handle}`);
