import { predictiveSearch } from "@/lib/products";
import { getSearch } from "@/lib/collection";

/**
 * The header search box's endpoint.
 *
 * It exists because the Storefront token is a SERVER-ONLY env name (SHOPIFY_STOREFRONT_TOKEN, no
 * NEXT_PUBLIC_ prefix), so the browser cannot query Shopify directly and should not be handed a
 * token so it can. This route is the whole of the "backend" the search box needs.
 *
 * Replaces `${BACKEND_URL}/api/products/search` -- a Fastify service that is not running, which is
 * why the box returned nothing regardless of what was typed.
 *
 * ponytail: a GET that reshapes one Shopify call. No search index, no cache layer, no debounce on
 * this side -- the header already debounces at 300ms and Shopify's own predictive search is the
 * index.
 */
export async function GET(request) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const cursor = request.nextUrl.searchParams.get("cursor");
  // The /search page's scroll-to-load (CollectionPage calls this with the page's own params --
  // filters and sort included -- plus the cursor). Next page only, no facets.
  if (cursor) {
    const page = await getSearch({
      query,
      search: request.nextUrl.searchParams.toString(),
      cursor,
      withFacets: false,
    });
    if (!page) return Response.json({ products: [], pageInfo: null }, { status: 502 });
    return Response.json({ products: page.products, pageInfo: page.pageInfo });
  }
  if (String(query).trim().length < 2) return Response.json({ results: [] });
  const found = await predictiveSearch(query);
  // null here is "Shopify unreachable", not "no matches" -- a 502 lets the header say search is
  // down instead of asserting "no matching products" for a term the store may well answer.
  if (!found) return Response.json({ error: "Search is unavailable" }, { status: 502 });

  // One flat list, tagged -- SearchPopup splits it back out by isCollection / isContent, and it
  // ordered them collections-first before this route existed.
  const results = [
    ...found.collections.map((collection) => ({
      id: `collection-${collection.handle}`,
      title: collection.title,
      url: `/collections/${collection.handle}`,
      image: "",
      isCollection: true,
    })),

    ...found.products.map((product) => ({
      id: `product-${product.handle}`,
      title: product.title,
      url: `/products/${product.handle}`,
      image: product.images[0] ?? "",
      // Formatted here rather than in the browser so the search row and the product card read the
      // same: per sq ft where Shopify gives a unit price, per pack where it does not.
      price: formatPrice(product.price, product.unit),
      isCollection: false,
    })),

    ...found.articles.map((article) => ({
      id: `article-${article.handle}`,
      title: article.title,
      // The app serves articles at /blog/<article> (one blog, see lib/blog.js) -- /blogs/... 404s.
      url: `/blog/${article.handle}`,
      image: "",
      price: "",
      isCollection: false,
      isContent: true,
      contentType: "Blog",
    })),

    ...found.pages.map((page) => ({
      id: `page-${page.handle}`,
      title: page.title,
      url: `/pages/${page.handle}`,
      image: "",
      price: "",
      isCollection: false,
      isContent: true,
      contentType: "Page",
    })),
  ];

  // The CDN absorbs repeated queries -- "tile" typed by fifty shoppers is one function invocation
  // per five minutes, matching the 300s the Shopify data behind it is cached for anyway.
  return Response.json({ results }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}

/** en-IN grouping, because ₹1,80,000 is not ₹180,000 to anyone reading this site. */
function formatPrice(amount, unit) {
  if (!amount) return "";
  const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
  return unit ? `₹${rupees}/${unit}` : `₹${rupees}`;
}
