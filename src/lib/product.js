// Relative rather than "@/" so the coverage maths below can be exercised under plain
// `node --test` without a bundler -- see product.test.mjs.
import { storefront, mapProducts, PRODUCT_FIELDS } from "./products.js";
import { attachRatings } from "./reviews.js";

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
      # 50, not 12: a product in several colours carries every colour's photos here.
      images(first: 50) { nodes { url altText width height } }
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
          coveragePerPack: metafield(namespace: "custom", key: "coverage_per_pack") { value }
          # Finish (Matte / Gloss) belongs to the VARIANT: one product can be sold in both.
          finish: metafield(namespace: "custom", key: "finish") { value }
          # This colour's photos, written by material-admin. A variant's own "image" is ONE photo;
          # this is the gallery the PDP swaps to when the colour is chosen.
          gallery: metafield(namespace: "custom", key: "variant_images") {
            references(first: 20) { nodes { ... on MediaImage { image { url altText width height } } } }
          }
        }
      }
      material: metafield(namespace: "custom", key: "material") { value }
      look: metafield(namespace: "custom", key: "look") { value }
      application: metafield(namespace: "custom", key: "application") { value }
      slipRating: metafield(namespace: "custom", key: "slip_rating") { value }
      installation: metafield(namespace: "custom", key: "installation_guide") { value }
      care: metafield(namespace: "custom", key: "care_maintenance") { value }
      samplePrice: metafield(namespace: "custom", key: "sample_price") { value }
      features: metafield(namespace: "custom", key: "features") { value }
      flexibility: metafield(namespace: "custom", key: "flexibility") { value }
      importantNote: metafield(namespace: "custom", key: "install_caveats") { value }
      colourFamily: metafield(namespace: "custom", key: "colour_family") { value }
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
  // 15 minutes, not the 24 hours the shelves use: this page shows stock ("Only N left") and price,
  // and a day-stale answer on either is an oversold order or a mispriced one.
  // throwOnError: "Shopify said null" is a real 404; "Shopify was down" must render error.js as a
  // 5xx, not tell Googlebot a live product no longer exists.
  const data = await storefront("getProduct", PRODUCT_QUERY, { handle }, 900, {
    throwOnError: true,
  });
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
export async function getRelated(collectionHandle, exclude, first = 17) {
  if (!collectionHandle) return [];
  const data = await storefront("getRelated", RELATED_QUERY, { handle: collectionHandle, first });
  return attachRatings(
    mapProducts(data?.collection?.products?.nodes).filter((p) => p.handle !== exclude),
  );
}

/**
 * The related shelf, trimmed to WHOLE ROWS.
 *
 * A grid ends on a ragged row the moment the count is not a multiple of the column count -- three
 * cards under a row of four, with a card-and-a-half of blank paper beside them, at the very bottom
 * of the page. Dropping the remainder costs a card or two nobody scrolled to and buys a shelf that
 * ends on a straight edge (user, 2026-09-05).
 *
 * IT NEVER TRIMS TO NOTHING, which is the whole reason this is a function and not a `slice` at the
 * call site. A collection holding three products floors to zero rows, and the section would vanish
 * -- taking the page's only way out with it, on exactly the small catalogue where that matters most.
 * Under one full row, show what there is and let the row be short.
 */
export function wholeRows(products, columns, max) {
  const capped = products.slice(0, max);
  if (capped.length < columns) return capped;
  return capped.slice(0, columns * Math.floor(capped.length / columns));
}

/**
 * The chips under the price -- Material Depot's row of "Easy to Install / Scratch Resistance /
 * Bathroom Wall". Theirs are a hand-tagged marketing list; ours come from the SPEC metafields that
 * are actually set, so a chip can never claim something the product data does not say.
 *
 * DERIVED, NOT SHIPPED (audited 2026-09-05). This used to be built during the mapping and sent as a
 * `chips` array alongside `specs` -- the same five facts serialised twice into every product
 * payload, one of them shaped for one component. Nothing else ever read it. A function costs the
 * page nothing and the wire nothing.
 *
 * Each chip carries its `kind` as well as its label, because SpecChips tints by kind -- the colour
 * is doing information design (what it is made of / how it behaves / where it goes) rather than
 * decoration, and that is only possible if the field it came from survives the mapping.
 */
export function specChips(specs) {
  if (!specs) return [];

  return [
    specs.look && { label: specs.look, kind: "look" },
    specs.material && { label: specs.material, kind: "material" },
    specs.finish && { label: `${specs.finish} finish`, kind: "finish" },
    specs.slipRating && { label: `Slip ${specs.slipRating}`, kind: "slip" },
    // No rooms: they are shown once, with icons, under "Where it works" in ProductInsights. The
    // chips are the at-a-glance summary beside the price -- what it IS, not where it goes.
  ].filter(Boolean);
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

export function mapProduct(p) {
  const variants = (p.variants?.nodes ?? []).map(mapVariant);

  // Featured image first, then the gallery, deduped by URL.
  const media = [p.featuredImage, ...(p.images?.nodes ?? [])]
    .filter(Boolean)
    .filter((img, i, all) => all.findIndex((o) => o.url === img.url) === i);

  // Images no colour claims are SHARED: shown with every colour, after its own. variant_images is
  // written when material-admin creates the product, so a photo added later in Shopify admin is
  // in nobody's list -- without this it showed on no colour at all (headline-laminate, 2026-10-19:
  // 7 images, 6 shown). Compared without the ?v= cache-buster, which can differ between the two.
  const key = (img) => img.url.split("?")[0];
  const claimed = new Set(variants.flatMap((v) => v.gallery.map(key)));
  const shared = media.filter((img) => !claimed.has(key(img)));
  for (const v of variants) if (v.gallery.length) v.gallery = [...v.gallery, ...shared];

  const collection = p.collections?.nodes?.[0] ?? null;

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description ?? "",
    descriptionHtml: p.descriptionHtml ?? "",
    category: p.productType || null,
    vendor: p.vendor || null,
    tags: p.tags ?? [],
    // ponytail: always sellable. Material does not track inventory -- tiles and laminates are
    // ordered in from the depot per order, so Shopify's availableForSale (false only when a
    // variant is tracked, at 0, and set to stop selling) describes a warehouse we do not run.
    // Requires those variants set to "Continue selling when out of stock" in Shopify, or order
    // creation fails AFTER payment. Read p.availableForSale again the day stock is real.
    inStock: true,
    seo: p.seo ?? {},
    media,
    collection,
    // Only options with a real choice. One option renders as one row of variant buttons; two or
    // more (Size AND Colour) render a row per option -- see VariantOptions.
    options: (p.options ?? []).filter((o) => o.optionValues?.length > 1),
    variants,
    specs: {
      // Finish is per VARIANT (Matte / Gloss) -- see the variant's own `finish`, not a product field.
      finish: null,
      material: p.material?.value ?? null,
      look: p.look?.value ?? null,
      slipRating: p.slipRating?.value ?? null,
      application: safeList(p.application?.value),
      features: safeList(p.features?.value),
      flexibility: p.flexibility?.value ?? null,
      importantNote: safeList(p.importantNote?.value),
      colourFamily: safeList(p.colourFamily?.value),
    },
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
    inStock: true, // ponytail: see mapProduct -- inventory is not tracked
    // Shopify only reports this when inventory is tracked AND the product is published to this
    // channel; null means "not saying", which is not the same as none.
    stock: v.quantityAvailable ?? null,
    options: Object.fromEntries((v.selectedOptions ?? []).map((o) => [o.name, o.value])),
    // This variant's own finish (Matte / Gloss), else its Finish option, else null. There is no
    // product-level finish: it cannot be right for a product sold in two.
    finish: v.finish?.value ?? (v.selectedOptions ?? []).find((o) => o.name === "Finish")?.value ?? null,
    image: v.image?.url ?? null,
    price,
    comparePrice,
    coverage: sold ? coverage : 0,
    perSqFt: sold ? perSqFt : 0,
    perSqFtCompare: sold && comparePrice > 0 ? comparePrice / coverage : 0,
    pieces: Number(v.pieces?.value ?? 0) || null,
    packUnit: v.packUnit?.value || "box",
    thickness: v.thickness?.value ? Number(v.thickness.value) : null,
    // Stored per pack, for products not sold per sq ft (panels, laminates) whose "coverage" is 0.
    coveragePerPack: Number(v.coveragePerPack?.value ?? 0) || null,
    gallery: (v.gallery?.references?.nodes ?? []).map((n) => n.image).filter(Boolean),
  };
}

/* ------------------------------------------------------------ options and specs */

/**
 * The variant a shopper means when they change ONE option: same choices otherwise, this one value
 * swapped. Falls back to any variant with that value (the combination may not be stocked), then
 * stays put.
 */
export function pickVariant(variants, current, name, value) {
  const want = { ...current.options, [name]: value };
  return (
    variants.find((v) => Object.entries(want).every(([k, x]) => v.options[k] === x)) ??
    variants.find((v) => v.options[name] === value) ??
    current
  );
}

/**
 * The photograph that stands for THIS variant -- its colour's first photo, else Shopify's variant
 * image, else the product's first. The buy sheet, the pinned bar and the wishlist all showed the
 * product's first photo, so choosing Blue in the sheet kept a Brown thumbnail (2026-10-20).
 */
export function variantPhoto(product, variant) {
  return variant?.gallery?.[0]?.url ?? variant?.image ?? product.media?.[0]?.url ?? null;
}

/** "Size: 2440 x 1220 mm, Colour: Walnut" -- for messages, where a bare variant title is ambiguous. */
export function optionText(product, variant) {
  const parts = product.options.map((o) => `${o.name}: ${variant.options[o.name]}`);
  if (parts.length) return parts.join(", ");
  return variant.title !== "Default Title" ? `Size: ${variant.title}` : "";
}

/**
 * The spec facts ProductInsights groups under "How it looks" and "Will it fit", in the catalogue
 * team's order, following the selected variant. Features, rooms and the note are NOT rows -- the
 * insights block gives each its own band. Empty rows are dropped.
 */
export function specRows(product, variant) {
  const s = product.specs;
  const coverage = variant.coverage || variant.coveragePerPack;
  return [
    // "Colour" from material-admin, "Color" on products made in Shopify admin -- either spelling.
    ["Colour", variant.options[Object.keys(variant.options).find((k) => /^colou?r$/i.test(k))] ?? s.colourFamily.join(", ")],
    ["Look", s.look],
    ["Finish", variant.finish],
    ["Material", s.material],
    ["Size", variant.options.Size ?? (variant.title !== "Default Title" ? variant.title : null)],
    ["Thickness", variant.thickness && `${variant.thickness} mm`],
    ["Coverage area", coverage && `${coverage} sq ft / ${variant.packUnit}`],
    ["Flexibility", s.flexibility],
    ["Slip rating", s.slipRating],
  ].filter(([, v]) => v);
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
