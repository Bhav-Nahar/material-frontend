import { predictiveSearch } from "@/lib/products";

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
  const found = await predictiveSearch(query);
  if (!found) return Response.json({ results: [] });

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
      url: `/blogs/${article.blog?.handle ?? "news"}/${article.handle}`,
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

  return Response.json({ results });
}

/** en-IN grouping, because ₹1,80,000 is not ₹180,000 to anyone reading this site. */
function formatPrice(amount, unit) {
  if (!amount) return "";
  const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
  return unit ? `₹${rupees}/${unit}` : `₹${rupees}`;
}
