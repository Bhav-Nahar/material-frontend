/**
 * Sort options, in the order they are offered.
 *
 * `key`/`reverse` are Shopify's own ProductCollectionSortKeys -- nothing is sorted in memory, so
 * the order is correct across the whole collection rather than only within the batch that happens
 * to be loaded.
 *
 * Its own file because the sidebar (client) and the query (server) both need it, and importing the
 * query module into the browser bundle would drag the Storefront client along with it.
 */
export const SORTS = [
  { value: "featured", label: "Featured", key: "COLLECTION_DEFAULT", reverse: false },
  { value: "best-selling", label: "Best selling", key: "BEST_SELLING", reverse: false },
  { value: "price-low", label: "Price: low to high", key: "PRICE", reverse: false },
  { value: "price-high", label: "Price: high to low", key: "PRICE", reverse: true },
  { value: "newest", label: "Newest first", key: "CREATED", reverse: true },
  { value: "title", label: "Alphabetical: A–Z", key: "TITLE", reverse: false },
];

export const DEFAULT_SORT = SORTS[0].value;

/**
 * Search sorts -- Shopify's SearchSortKeys has only RELEVANCE and PRICE, so best-selling, newest
 * and A-Z are not offered on /search rather than offered and silently ignored.
 */
export const SEARCH_SORTS = [
  { value: "relevance", label: "Most relevant", key: "RELEVANCE", reverse: false },
  { value: "price-low", label: "Price: low to high", key: "PRICE", reverse: false },
  { value: "price-high", label: "Price: high to low", key: "PRICE", reverse: true },
];
