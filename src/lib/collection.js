// Relative, not "@/lib/...": that alias is a bundler feature, and these two lines are what let
// collection.test.mjs run under plain `node --test` with no config.
import { PRODUCT_FIELDS, mapProducts, storefront } from "./products.js";
import { attachRatings } from "./reviews.js";
import { SEARCH_SORTS, SORTS } from "./sorts.js";

/**
 * The collection page's data layer.
 *
 * ONE Shopify query returns the products AND the filter sidebar AND the counts. Shopify's
 * `products(filters:)` connection already computes every facet, its labels and its per-value
 * counts against the current filter set -- that IS the filter model, so there is nothing here that
 * derives, merges or re-counts facets.
 *
 * What that replaces, measured on the jewelry build's live PLP (see the notes on `filterInput` and
 * `PAGE_SIZE`): two round trips per filter change (filters first, then products, because the
 * product call needed the filter call's `input` strings), plus two more requests per product card
 * for live pricing and reviews. One page of 25 products came to 1.22 MB, 98% of it variants the
 * card never renders.
 */

/** Divisible by 2, 3 and 4, so the last row is full at every grid width. */
export const PAGE_SIZE = 24;

/** Query keys that steer the page rather than filter it. Everything else is a facet. */
const CONTROL_PARAMS = new Set(["sort", "cursor", "q", "page"]);

/** Price arrives as two params so the two ends of a slider can move independently. */
const PRICE_MIN = "price.gte";
const PRICE_MAX = "price.lte";

/**
 * A Shopify filter id, plus the value's own label, is enough to rebuild the `input` Shopify would
 * have handed back -- the mapping is fixed and documented, not guessed.
 *
 * That is the whole reason this page makes one request where the jewelry build's makes two: the
 * jewelry build reads `input` off a filters response, so it cannot ask for filtered products until
 * a filters call has returned. Deriving the input from the URL breaks that dependency.
 *
 * Returns null for an id we do not recognise, and the caller drops it -- an unknown param must
 * never silently widen or narrow the result set.
 */
function filterInput(id, value) {
  if (id === "filter.v.availability") return { available: value === "In stock" };
  if (id === "filter.p.product_type") return { productType: value };
  if (id === "filter.p.vendor") return { productVendor: value };
  if (id === "filter.p.tag") return { tag: value };

  const option = id.match(/^filter\.v\.option\.(.+)$/);
  if (option) return { variantOption: { name: option[1], value } };

  const metafield = id.match(/^filter\.([pv])\.m\.([^.]+)\.(.+)$/);
  if (metafield) {
    const field = { namespace: metafield[2], key: metafield[3], value };
    return metafield[1] === "p" ? { productMetafield: field } : { variantMetafield: field };
  }

  return null;
}

/**
 * URLSearchParams (or a query string) -> the `filters:` argument, plus the leftovers.
 *
 * Exported for the self-check: this mapping is the one piece of the page that can be wrong in a
 * way nothing visibly breaks -- a dropped filter just returns more products than it should.
 */
export function readFilters(params) {
  const search = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const filters = [];
  const unresolved = [];

  const min = Number(search.get(PRICE_MIN));
  const max = Number(search.get(PRICE_MAX));
  if (min > 0 || max > 0) {
    const price = {};
    if (min > 0) price.min = min;
    if (max > 0) price.max = max;
    filters.push({ price });
  }

  for (const [key, value] of search.entries()) {
    if (CONTROL_PARAMS.has(key) || key === PRICE_MIN || key === PRICE_MAX) continue;
    const input = filterInput(key, value);
    if (input) filters.push(input);
    else unresolved.push([key, value]);
  }

  return { filters, unresolved };
}

/**
 * The mega menu and the homepage link with readable params -- `?look=marble`, `?room=bathroom`
 * (see data/catalog.js). Those are not Shopify filter ids, so they are matched by NAME against the
 * facets the collection actually returned: a group labelled "Look" with a value labelled "Marble".
 *
 * ponytail: costs a second request, and only when such a param is present. Resolving it in the
 * first request would mean fetching the facet list before the products, which is exactly the extra
 * round trip this file exists to avoid -- so the cost lands on the legacy links instead of on
 * every page view. It disappears entirely once those links carry filter ids.
 */
function resolveNamedFilters(unresolved, facets) {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

  return unresolved.flatMap(([key, value]) => {
    const group = facets.find((f) => slug(f.label) === slug(key));
    const match = group?.values.find((v) => slug(v.label) === slug(value));
    if (!match) return [];
    try {
      return [JSON.parse(match.input)];
    } catch {
      return [];
    }
  });
}

const COLLECTION_QUERY = `
  query Collection(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys!
    $reverse: Boolean!
    $filters: [ProductFilter!]
    $withFacets: Boolean!
  ) {
    collection(handle: $handle) {
      title
      # Feeds the <meta description> only -- the page itself does not print the collection blurb.
      # descriptionHtml is deliberately not fetched: nothing renders it.
      description
      image @include(if: $withFacets) { url altText }
      seo @include(if: $withFacets) { title description }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        # Only on the first page. A scroll-to-load page does not need the sidebar resent 20 times,
        # and @include is the native way to say so without a second query string to keep in step.
        filters @include(if: $withFacets) {
          id
          label
          type
          values { id label count input }
        }
        pageInfo { hasNextPage endCursor }
        nodes { ${PRODUCT_FIELDS} }
      }
    }
  }
`;

/**
 * One page of a collection, with its facets.
 *
 * `cursor` paginates. Shopify's cursors are opaque and stable, so page 20 is as correct as page 2
 * -- the jewelry build's are `{last_id, last_value, offset}` encoded by hand, which is what makes
 * its deep pages drift.
 *
 * Returns null when the collection does not exist (Shopify returns `collection: null`, not an
 * error), so the caller can 404.
 */
export async function getCollection({
  handle,
  search = "",
  cursor = null,
  first = PAGE_SIZE,
  withFacets = true,
}) {
  const params = new URLSearchParams(search);
  const sort = SORTS.find((s) => s.value === params.get("sort")) ?? SORTS[0];
  const { filters, unresolved } = readFilters(params);

  // One hour, and throwOnError: a missing collection is a 404, but a Shopify outage must render
  // error.js as a 5xx rather than 404 every live listing to shoppers and to Googlebot.
  const ask = (applied, facets) =>
    storefront(
      "getCollection",
      COLLECTION_QUERY,
      {
        handle,
        first,
        after: cursor,
        sortKey: sort.key,
        reverse: sort.reverse,
        filters: applied,
        withFacets: facets,
      },
      3600,
      { throwOnError: true },
    );

  let data = await ask(filters, withFacets || unresolved.length > 0);
  if (!data?.collection) return null;

  if (unresolved.length > 0) {
    const named = resolveNamedFilters(unresolved, data.collection.products.filters ?? []);
    if (named.length > 0) {
      // Best-effort refinement: we already hold a renderable page, so a failure on this second
      // request degrades to the unrefined grid rather than throwing the whole page away.
      data = (await ask([...filters, ...named], withFacets).catch(() => null)) ?? data;
    }
  }

  const collection = data.collection;
  const page = collection.products;

  return {
    handle,
    title: collection.title,
    description: collection.description ?? "",
    image: collection.image ?? null,
    seo: collection.seo ?? null,
    sort: sort.value,
    products: await attachRatings(mapProducts(page.nodes)),
    facets: (page.filters ?? []).map(cleanFacet).filter(Boolean),
    pageInfo: page.pageInfo,
    totalCount: totalFrom(page.filters),
  };
}

/**
 * Full search for /search -- the collection page's data, for a search term instead of a handle.
 *
 * Same URL params (readFilters), same facets (cleanFacet), same page size and product shape, so
 * /search renders through CollectionPage itself: sidebar, mobile filter sheet, chips, price
 * slider, counts and scroll-to-load are the collection page's own, not a second copy.
 *
 * It replaced predictiveSearch on /search (2026-10-19): that is capped at 10 per type, and asking
 * it for 20 failed the whole call, so every search said "Nothing matched".
 *
 * Every page MUST use the same `first`: Shopify's search cursors are tied to the page size they
 * came from -- measured, a cursor from a first:5 page returns NOTHING when asked for first:24.
 * /search and /api/search both take PAGE_SIZE, which is what keeps them in step.
 *
 * ponytail: the readable `?look=marble` params the menu uses are not resolved here (that costs a
 * facets round trip, see resolveNamedFilters). Search URLs only ever carry the filter ids the
 * sidebar writes.
 */
export async function getSearch({ query, search = "", cursor = null, withFacets = true }) {
  const q = String(query || "").trim();
  if (q.length < 2) return null;
  const params = new URLSearchParams(search);
  const sort = SEARCH_SORTS.find((s) => s.value === params.get("sort")) ?? SEARCH_SORTS[0];
  const { filters } = readFilters(params);

  // 5 minutes: a shopper searching for this morning's new product should find it today.
  const data = await storefront(
    "getSearch",
    SEARCH_QUERY,
    {
      q,
      first: PAGE_SIZE,
      after: cursor,
      sortKey: sort.key,
      reverse: sort.reverse,
      filters,
      withFacets,
    },
    300,
  );
  const found = data?.search;
  if (!found) return null;

  return {
    sort: sort.value,
    products: await attachRatings(mapProducts(found.nodes.filter((n) => n?.handle))),
    facets: (found.productFilters ?? []).map(cleanFacet).filter(Boolean),
    pageInfo: found.pageInfo ?? { hasNextPage: false, endCursor: null },
    // search() reports its own total, filters applied -- no need to add up facet counts.
    totalCount: found.totalCount ?? null,
  };
}

const SEARCH_QUERY = `
  query Search(
    $q: String!
    $first: Int!
    $after: String
    $sortKey: SearchSortKeys!
    $reverse: Boolean!
    $filters: [ProductFilter!]
    $withFacets: Boolean!
  ) {
    search(
      query: $q
      first: $first
      after: $after
      sortKey: $sortKey
      reverse: $reverse
      types: [PRODUCT]
      productFilters: $filters
      unavailableProducts: LAST
    ) {
      totalCount
      productFilters @include(if: $withFacets) {
        id
        label
        type
        values { id label count input }
      }
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Product {
          ${PRODUCT_FIELDS}
        }
      }
    }
  }
`;

/**
 * Drops facets that cannot filter anything -- a group whose every value would return the same set
 * the shopper is already looking at is a row of checkboxes that does nothing.
 */
export function cleanFacet(facet) {
  if (facet.type === "PRICE_RANGE") {
    const bounds = safeParse(facet.values[0]?.input)?.price ?? {};
    if (!(bounds.max > 0)) return null;
    return { id: facet.id, label: facet.label, type: facet.type, min: bounds.min ?? 0, max: bounds.max };
  }

  const values = facet.values.filter((v) => v.count > 0);
  if (values.length < 2) return null;

  return {
    id: facet.id,
    label: facet.label,
    type: facet.type,
    values: values.map((v) => ({ id: v.id, label: v.label, count: v.count })),
  };
}

/**
 * How many products match the current filters.
 *
 * Shopify's Storefront API exposes no count on a filtered connection, so this reads the one place
 * the number already exists: the availability facet's own value counts, which Shopify computes
 * with every OTHER filter applied.
 *
 * ponytail: returns null if a merchant has turned that facet off in Search & Discovery, and the UI
 * falls back to "24+". The alternative is paging the whole collection to count it.
 */
function totalFrom(facets) {
  const availability = (facets ?? []).find((f) => f.id === "filter.v.availability");
  if (!availability) return null;
  return availability.values.reduce((sum, v) => sum + v.count, 0);
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Every collection handle, for generateStaticParams. */
export async function getCollectionHandles() {
  const data = await storefront(
    "getCollectionHandles",
    `{ collections(first: 250) { nodes { handle } } }`,
    {},
  );
  return (data?.collections?.nodes ?? []).map((c) => c.handle);
}
