// Relative rather than the "@/" alias so this module, and collection.js above it, load under plain
// `node --test` without a bundler.
import { PLACEHOLDER_PRODUCTS } from "../data/products.js";
import { attachRatings } from "./reviews.js";

/**
 * Server-side product reads, straight from Shopify.
 *
 * These are the server-only env names set in .env.local, so the token never reaches the client,
 * and the fetch is cached with the page's own revalidate window instead of forcing the homepage to
 * render dynamically on every request. (A browser-side client reading NEXT_PUBLIC_* token names
 * used to live in lib/shopify-client.js -- deleted; a NEXT_PUBLIC_ Storefront token ships the
 * token to every visitor and must not come back.)
 */
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-01";

/** Below this many products a category shelf is not worth rendering, let alone designing against. */
const MIN_SHELF = 4;

/**
 * The fields a ProductCard needs. Shared verbatim by both queries below so a card cannot render
 * differently depending on which one fetched it.
 */
export const PRODUCT_FIELDS = `
        # Nothing on a card renders this; analytics joins on it. A dataLayer event keyed by handle
        # cannot be reconciled against a Shopify order line, which carries the numeric id.
        id
        handle
        title
        availableForSale
        tags
        productType
        # Not first: 1. "First" is first BY POSITION, so a product whose ₹1,180 size is listed
        # second showed ₹1,845 on the card -- and Shopify filters at variant level, so filtering to
        # "under ₹1,500" returned that product with a price above ₹1,500 printed on it.
        # mapProducts picks the cheapest of these.
        #
        # ponytail: 10, not all of them. Tiles and laminates carry a handful of sizes and finishes;
        # a product with more than 10 variants could hide a cheaper one past the cut. If the
        # catalogue ever grows that deep, compare against priceRange.minVariantPrice (already
        # fetched below) to detect it rather than raising this number -- the jewelry build
        # fetches every variant, and 98% of its collection payload is variants no card renders.
        variants(first: 10) {
          nodes {
            id
            sku
            price { amount }
            compareAtPrice { amount }
            # Shopify's native unit price, set to AREA/FT2. The ADMIN UI only offers imperial
            # length, but the Admin API accepts FT2 -- scripts/create-test-product.mjs sets it --
            # so the stored unit is honest and feeds (Google Merchant) can use it as-is.
            # quantityValue is the pack's coverage; the unit itself is not read below, so a
            # variant set to "ft" by hand in the admin still works.
            unitPrice { amount }
            unitPriceMeasurement { quantityValue quantityUnit referenceValue referenceUnit }
            # Names the pack for the secondary line. Optional; defaults to "box".
            packUnit: metafield(namespace: "custom", key: "pack_unit") { value }
          }
        }
        featuredImage { url altText }
        priceRange { minVariantPrice { amount } }
        compareAtPriceRange { minVariantPrice { amount } }
        images(first: 5) { nodes { url } }
`;

const COLLECTION_PRODUCTS = `
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      products(first: $first, sortKey: BEST_SELLING) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }
  }
`;

/**
 * Best sellers within one collection, for the per-category homepage sections. Returns [] when the
 * collection does not exist yet -- `collection(handle:)` is null then, not an error.
 *
 * ponytail: one query, filtered in memory by the caller for the look tabs. Shopify's own
 * `filters:` argument would mean a round trip per tab and an API route to proxy it; a homepage
 * section that fetches 24 tiles once can filter them itself.
 */
export async function getCollectionProducts(handle, first = 24) {
  const data = await storefront("getCollectionProducts", COLLECTION_PRODUCTS, { handle, first });
  const products = mapProducts(data?.collection?.products?.nodes);

  // A one-product shelf cannot be designed against, and `tiles` really does hold one product today,
  // so in DEVELOPMENT a thin result is topped up from the placeholders rather than replaced -- the
  // real product still shows, first. devFallback returns [] in production, so this is just
  // `products` there and nothing invented can ship.
  // Ratings AFTER the top-up, so the placeholders go through the same path and simply come back
  // with rating: null rather than being a second shape the card has to handle.
  return attachRatings(
    products.length >= MIN_SHELF ? products : [...products, ...devFallback(handle)],
  );
}

/**
 * Shopify's own predictive search, which the Search & Discovery app powers -- it is what puts
 * synonyms, misspellings and the merchandiser's search rules behind the box in the header.
 *
 * ONE request covers products, collections, articles and pages. The header used to make two: a
 * dead call to the Fastify backend for products, and a Storefront call for editorial content that
 * could never work either (see searchContent -- it reads NEXT_PUBLIC_* token names that are not
 * set). Both are replaced by this.
 *
 * `limitScope: EACH` so `limit` is per type; the default (ALL) lets six products crowd out every
 * collection, which is the one result a shopper typing "marble" most wants.
 *
 * Products come back through mapProducts, exactly as the shelves get them, so a search result and a
 * product card cannot disagree about the price. No devFallback here on purpose: inventing a
 * placeholder match for a term the store cannot answer is a lie, where an empty shelf is not.
 */
export async function predictiveSearch(term, limit = 6) {
  const query = String(term || "").trim();
  if (query.length < 2) return null;

  // 5 minutes, not the 24 hours the shelves use: a shopper who searches for the product that was
  // added this morning should find it today.
  // Shopify caps predictiveSearch at 10 per type and REJECTS anything higher ("limit must be
  // within 1..10") -- the whole call fails, which /search rendered as "Nothing matched" for every
  // term while the header dropdown (limit 6) kept working. Clamped here so no caller can trip it.
  const data = await storefront(
    "predictiveSearch",
    PREDICTIVE_SEARCH,
    { q: query, limit: Math.min(Math.max(1, limit), 10) },
    300,
  );
  const found = data?.predictiveSearch;
  if (!found) return null;

  return {
    // Ratings here too, because /search renders full ProductCards off this and a card with no stars
    // beside the same product that has them on the shelf reads as a data bug. The ratings fetch is
    // cached separately (1h) from this one (5m), so the header dropdown pays for it once an hour.
    products: await attachRatings(mapProducts(found.products)),
    collections: found.collections ?? [],
    articles: found.articles ?? [],
    pages: found.pages ?? [],
  };
}

/**
 * Full search, for the /search results page: every matching product, a page at a time.
 *
 * predictiveSearch above is for the header dropdown -- fast, typo-tolerant, but capped at 10 per
 * type. Shopify's search() has no such cap, reports the total, and pages by cursor, so pressing
 * Enter shows everything that matched rather than the first ten. Same PRODUCT_FIELDS and
 * mapProducts, so a result card and a shelf card cannot disagree.
 *
 * `unavailableProducts: LAST` keeps sellable products first without hiding the rest.
 *
 * Every page MUST use the same `first`: Shopify's search cursors are tied to the page size they
 * came from -- measured, a cursor from a first:5 page returns NOTHING when asked for first:24. The
 * /search page and /api/search both take the default, which is what keeps them in step.
 */
export async function searchProducts(term, { first = 24, after = null } = {}) {
  const query = String(term || "").trim();
  if (query.length < 2) return null;
  const data = await storefront("searchProducts", SEARCH_PRODUCTS, { q: query, first, after }, 300);
  const found = data?.search;
  if (!found) return null;
  return {
    total: found.totalCount ?? 0,
    products: await attachRatings(mapProducts(found.nodes.filter((n) => n?.handle))),
    // Same shape the collection page scrolls on: { hasNextPage, endCursor }.
    pageInfo: found.pageInfo ?? { hasNextPage: false, endCursor: null },
  };
}

const SEARCH_PRODUCTS = `
  query SearchProducts($q: String!, $first: Int!, $after: String) {
    search(query: $q, first: $first, after: $after, types: [PRODUCT], unavailableProducts: LAST) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Product {
          ${PRODUCT_FIELDS}
        }
      }
    }
  }
`;

const PREDICTIVE_SEARCH = `
  query PredictiveSearch($q: String!, $limit: Int!) {
    predictiveSearch(
      query: $q
      limit: $limit
      limitScope: EACH
      types: [PRODUCT, COLLECTION, ARTICLE, PAGE]
    ) {
      products {
        ${PRODUCT_FIELDS}
      }
      collections { title handle }
      articles { title handle blog { handle } }
      pages { title handle }
    }
  }
`;

/**
 * One POST to the Storefront API. Returns null on any failure by default -- a homepage section is
 * not worth a 500, and those callers fall back to the placeholders or to nothing.
 *
 * `throwOnError` is for the PDP and the PLP, where the difference between "Shopify said this
 * product does not exist" (data.product === null → a real 404) and "Shopify was down/throttled"
 * (→ throw, so error.js renders a 5xx) is the difference between a missing page and Google
 * deindexing live products during an outage.
 *
 * ponytail: no retry, no client-side cache layer. `revalidate` already means one request a day for
 * the shelves; search passes a shorter window.
 */
export async function storefront(label, query, variables, revalidate = 86400, { throwOnError = false } = {}) {
  const fail = (message) => {
    console.warn(`[${label}] ${message}`);
    if (throwOnError) throw new Error(`[${label}] ${message}`);
    return null;
  };

  if (!DOMAIN || !TOKEN) return fail("SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_TOKEN not set");

  let res;
  try {
    res = await fetch(`https://${DOMAIN}/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate },
    });
  } catch (err) {
    return fail(`request failed: ${err.message}`);
  }

  if (!res.ok) return fail(`Shopify returned ${res.status}`);

  const { data, errors } = await res.json();
  if (errors?.length) return fail(errors[0].message);

  return data;
}

export function mapProducts(nodes) {
  return (nodes ?? []).map((p) => {
      const gallery = (p.images?.nodes ?? []).map((img) => img.url);
      const primary = p.featuredImage?.url ?? gallery[0] ?? null;
      // Featured image first, then the rest, deduped -- the card scrolls through this list.
      const images = [primary, ...gallery].filter((url, i, all) => url && all.indexOf(url) === i);

      /**
       * The card prices the CHEAPEST variant, by pack price.
       *
       * Pack price rather than per-sq-ft, because that is the number Shopify's own price filter
       * matches on -- so a card can never show a figure outside the range the shopper filtered to.
       * Everything below (unit price, coverage, compare-at, pack unit) then comes off that same
       * variant, so the row cannot mix two variants' numbers.
       */
      const variants = p.variants?.nodes ?? [];
      const v = variants.reduce(
        (cheapest, next) =>
          Number(next.price?.amount ?? Infinity) < Number(cheapest.price?.amount ?? Infinity)
            ? next
            : cheapest,
        variants[0],
      );
      // More than one variant means this is the lowest of several, and the card says "from".
      const fromPrice = variants.length > 1;

      /**
       * Per-square-foot pricing, via Shopify's native unit price.
       *
       * Variant price is the PACK price (₹1,844.50 a box) and "unit price" carries the pack's
       * coverage (15.5 FT2). Shopify divides: ₹119.00 per sq ft. Proven against a real product --
       * see scripts/verify-product.mjs.
       *
       * The unit itself is deliberately NOT read here, only quantityValue. A variant set to FT2
       * by the API and one set to "ft" by hand in the admin both work, because the number means
       * square feet either way.
       *
       * Shopify charges in whole packs, so the PACK price stays authoritative and per-sq-ft is
       * display-only; deriving it the other way round rounds paise off what is actually charged.
       */
      const packPrice = Number(v?.price?.amount ?? p.priceRange?.minVariantPrice?.amount ?? 0);
      // THIS variant's compare-at or nothing. Falling back to compareAtPriceRange borrowed another
      // variant's MRP and struck it against the cheapest variant's price -- a fabricated discount.
      const packCompare = Number(v?.compareAtPrice?.amount ?? 0);
      const coverage = Number(v?.unitPriceMeasurement?.quantityValue ?? 0);
      const perSqFtPrice = Number(v?.unitPrice?.amount ?? 0);
      // Both must be present: without coverage there is no honest compare-at per sq ft either.
      const perSqFt = perSqFtPrice > 0 && coverage > 0;

      return {
        // Analytics only -- see the note on `id` in PRODUCT_FIELDS. `variantId` is the CHEAPEST
        // variant's, the same one every price on this card is read off, so an impression and the
        // price beside it can never describe two different variants.
        id: p.id,
        variantId: v?.id ?? null,
        handle: p.handle,
        title: p.title,
        category: p.productType || null,
        sku: v?.sku || null,
        price: perSqFt ? perSqFtPrice : packPrice,
        fromPrice,
        // Shopify computes no unit price for compare-at, so this one is divided by hand.
        comparePrice: perSqFt ? packCompare / coverage : packCompare,
        unit: perSqFt ? "sq ft" : null,
        // Only worth showing beside a per-sq-ft price; on its own it IS the price.
        packPrice: perSqFt ? packPrice : 0,
        // Shopify's compare-at, UNDIVIDED. The struck price is shown against the pack price it
        // actually belongs to, so the card needs the box figure and not the per-sq-ft one.
        packCompare: perSqFt ? packCompare : 0,
        packUnit: v?.packUnit?.value || "box",
        images,
        tags: p.tags ?? [],
        alt: p.featuredImage?.altText ?? "",
        inStock: true, // ponytail: inventory is not tracked; see mapProduct in src/lib/product.js
      };
  });
}

/**
 * The store has one product and one collection. Show the placeholders while developing so the
 * sections can be designed, and show nothing in production so invented products can never ship.
 *
 * `collection` narrows the placeholders to the one a per-category section asked for; without it
 * the caller gets the lot.
 */
function devFallback(collection) {
  if (process.env.NODE_ENV === "production") return [];
  if (!collection) return PLACEHOLDER_PRODUCTS;
  return PLACEHOLDER_PRODUCTS.filter((p) => p.collection === collection);
}
