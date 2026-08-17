// Relative rather than "@/" so the coverage maths below can be exercised under plain
// `node --test` without a bundler -- see product.test.mjs.
import { storefront, mapProducts, PRODUCT_FIELDS } from "./products.js";

/**
 * ONE product, everything the PDP renders, in ONE request.
 *
 * The jewelry build's equivalent query is 150 lines of jewelry metafields with four fallback chains
 * per stone, and the page it feeds then makes further calls per view for variant pricing, reviews
 * and store stock. Everything below is read once, on the server, and cached with the page.
 *
 * The fields map exactly onto what scripts/setup-product-model.mjs creates, which is in turn what
 * scripts/verify-product-model.mjs asserts is readable. If a spec is missing on the PDP, run that
 * verifier before touching this file -- a metafield definition without PUBLIC_READ storefront
 * access returns null rather than an error, so it fails silently.
 */
const PRODUCT_QUERY = `
  query Product($handle: String!) {
    product(handle: $handle) {
      # Analytics joins on this -- see PRODUCT_FIELDS in products.js.
      id
      title
      handle
      description
      descriptionHtml
      productType
      tags
      vendor
      availableForSale
      seo { title description }
      featuredImage { url altText width height }
      images(first: 12) { nodes { url altText width height } }
      # The first collection a product sits in names the middle of the breadcrumb, the way
      # Material Depot's reads Home / Tiles / Subway & Backsplash.
      collections(first: 1) { nodes { title handle } }
      options { name optionValues { name } }
      variants(first: 25) {
        nodes {
          id
          title
          sku
          availableForSale
          quantityAvailable
          selectedOptions { name value }
          price { amount }
          compareAtPrice { amount }
          unitPrice { amount }
          unitPriceMeasurement { quantityValue quantityUnit }
          image { url altText }
          pieces: metafield(namespace: "custom", key: "pieces_per_pack") { value }
          packUnit: metafield(namespace: "custom", key: "pack_unit") { value }
          thickness: metafield(namespace: "custom", key: "thickness_mm") { value }
        }
      }
      finish: metafield(namespace: "custom", key: "finish") { value }
      material: metafield(namespace: "custom", key: "material") { value }
      look: metafield(namespace: "custom", key: "look") { value }
      application: metafield(namespace: "custom", key: "application") { value }
      slipRating: metafield(namespace: "custom", key: "slip_rating") { value }
      installation: metafield(namespace: "custom", key: "installation_guide") { value }
      care: metafield(namespace: "custom", key: "care_maintenance") { value }
      samplePrice: metafield(namespace: "custom", key: "sample_price") { value }
    }
  }
`;

/** Best sellers from the same collection, for the rail under the fold. */
const RELATED_QUERY = `
  query Related($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      products(first: $first, sortKey: BEST_SELLING) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }
  }
`;

export async function getProduct(handle) {
  const data = await storefront("getProduct", PRODUCT_QUERY, { handle });
  return data?.product ? mapProduct(data.product) : null;
}

/**
 * The rail under the PDP. Returns [] rather than throwing when the product is in no collection --
 * a shelf that cannot be filled is simply not rendered.
 *
 * ponytail: same-collection best sellers, not a recommendation engine. Shopify's
 * `productRecommendations` needs its own request and has nothing to learn from on a store with one
 * product; swap this body for it when there is order history worth mining.
 */
export async function getRelated(collectionHandle, exclude, first = 12) {
  if (!collectionHandle) return [];
  const data = await storefront("getRelated", RELATED_QUERY, { handle: collectionHandle, first });
  return mapProducts(data?.collection?.products?.nodes).filter((p) => p.handle !== exclude);
}

/* ------------------------------------------------------------------ coverage maths */

/**
 * Boxes to order to cover `area` square feet, with wastage on top.
 *
 * Rounded UP because Shopify sells whole packs -- scripts/verify-cart.mjs proves it rejects a
 * fractional quantity outright, so a calculator that suggested 14.3 boxes would be suggesting an
 * order that cannot be placed.
 */
export function boxesForArea(area, coverage, wastage = 0.1) {
  if (!(area > 0) || !(coverage > 0)) return 0;
  return Math.ceil((area * (1 + wastage)) / coverage);
}

/** What those boxes actually cover -- the honest number, wastage included, not the area asked for. */
export function areaForBoxes(boxes, coverage) {
  if (!(boxes > 0) || !(coverage > 0)) return 0;
  return Math.round(boxes * coverage * 10) / 10;
}

/* ---------------------------------------------------------------------- mapping */

function mapProduct(p) {
  const variants = (p.variants?.nodes ?? []).map(mapVariant);

  // Featured image first, then the gallery, deduped by URL.
  const media = [p.featuredImage, ...(p.images?.nodes ?? [])]
    .filter(Boolean)
    .filter((img, i, all) => all.findIndex((o) => o.url === img.url) === i);

  const collection = p.collections?.nodes?.[0] ?? null;

  /**
   * The chips under the price -- Material Depot's row of "Easy to Install / Scratch Resistance /
   * Bathroom Wall". Theirs are a hand-tagged marketing list; ours are the SPEC metafields that are
   * actually set, so a chip can never claim something the product data does not say.
   *
   * Each chip carries its `kind` as well as its label, because SpecChips tints by kind -- the colour
   * is doing information design (what it is made of / how it behaves / where it goes) rather than
   * decoration, and that is only possible if the field it came from survives the mapping.
   */
  const chips = [
    p.look?.value && { label: p.look.value, kind: "look" },
    p.material?.value && { label: p.material.value, kind: "material" },
    p.finish?.value && { label: `${p.finish.value} finish`, kind: "finish" },
    p.slipRating?.value && { label: `Slip ${p.slipRating.value}`, kind: "slip" },
    // Rooms last, and tagged as one kind however many there are -- they are a different sort of
    // fact from the four above (where it goes, not what it is), and SpecChips colours them apart.
    ...safeList(p.application?.value).map((room) => ({ label: room, kind: "room" })),
  ].filter(Boolean);

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description ?? "",
    descriptionHtml: p.descriptionHtml ?? "",
    category: p.productType || null,
    vendor: p.vendor || null,
    tags: p.tags ?? [],
    inStock: p.availableForSale,
    seo: p.seo ?? {},
    media,
    collection,
    // Shopify allows several; the PDP renders each as its own row of choices, so a product with a
    // Size AND a Colour option needs no code change.
    options: (p.options ?? []).filter((o) => o.optionValues?.length > 1),
    variants,
    specs: {
      finish: p.finish?.value ?? null,
      material: p.material?.value ?? null,
      look: p.look?.value ?? null,
      slipRating: p.slipRating?.value ?? null,
      application: safeList(p.application?.value),
    },
    chips,
    // Multi-line text metafields, split into the lines the admin typed. Rendered as a list; the
    // field carries no markup and is not run through dangerouslySetInnerHTML.
    installation: lines(p.installation?.value),
    care: lines(p.care?.value),
    samplePrice: Number(p.samplePrice?.value ?? 0) || null,
  };
}

/**
 * One variant, priced BOTH ways.
 *
 * `price` is the pack price -- what Shopify charges and what the cart totals. `perSqFt` is
 * Shopify's own unit price, which is the pack price divided by the coverage it carries. Compare-at
 * has no unit price of its own (Shopify computes none), so it is divided here by the same
 * coverage, which keeps the discount percentage identical whichever figure it is read off.
 */
function mapVariant(v) {
  const coverage = Number(v.unitPriceMeasurement?.quantityValue ?? 0);
  const perSqFt = Number(v.unitPrice?.amount ?? 0);
  const price = Number(v.price?.amount ?? 0);
  const comparePrice = Number(v.compareAtPrice?.amount ?? 0);
  const sold = perSqFt > 0 && coverage > 0;

  return {
    id: v.id,
    title: v.title,
    sku: v.sku || null,
    inStock: v.availableForSale,
    // Shopify only reports this when inventory is tracked AND the product is published to this
    // channel; null means "not saying", which is not the same as none.
    stock: v.quantityAvailable ?? null,
    options: Object.fromEntries((v.selectedOptions ?? []).map((o) => [o.name, o.value])),
    image: v.image?.url ?? null,
    price,
    comparePrice,
    coverage: sold ? coverage : 0,
    perSqFt: sold ? perSqFt : 0,
    perSqFtCompare: sold && comparePrice > 0 ? comparePrice / coverage : 0,
    pieces: Number(v.pieces?.value ?? 0) || null,
    packUnit: v.packUnit?.value || "box",
    thickness: v.thickness?.value ? Number(v.thickness.value) : null,
  };
}

/**
 * The PDP's product, reshaped into what a ProductCard renders -- same fields, same choices as
 * mapProducts: priced off the CHEAPEST variant by pack price, per-sq-ft leading when the variant
 * carries coverage. The recently-viewed rail stores this in localStorage, so it must be the card's
 * whole diet and nothing more.
 */
export function toCardProduct(product) {
  const v = product.variants.reduce((low, next) => (next.price < low.price ? next : low), product.variants[0]);
  if (!v) return null;

  const perSqFt = v.perSqFt > 0;
  return {
    // Same pair as mapProducts puts on a card, so a recently-viewed tile fires the same
    // impression as a collection tile.
    id: product.id,
    variantId: v.id,
    handle: product.handle,
    title: product.title,
    category: product.category,
    sku: v.sku,
    price: perSqFt ? v.perSqFt : v.price,
    fromPrice: product.variants.length > 1,
    comparePrice: perSqFt ? v.perSqFtCompare : v.comparePrice,
    unit: perSqFt ? "sq ft" : null,
    packPrice: perSqFt ? v.price : 0,
    packUnit: v.packUnit,
    images: product.media.map((m) => m.url),
    tags: product.tags,
    alt: product.media[0]?.altText ?? "",
    inStock: product.inStock,
  };
}

/** list.single_line_text_field arrives as a JSON array in a string. */
function safeList(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lines(text) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
