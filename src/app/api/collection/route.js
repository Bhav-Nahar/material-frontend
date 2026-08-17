import { getCollection } from "@/lib/collection";

/**
 * The next page of a collection, for scroll-to-load.
 *
 * This is the ONLY thing the collection page fetches from the browser. Filter and sort changes go
 * through the URL and re-render the server component instead, so they cost no client code, stay
 * shareable, and arrive rendered.
 *
 * `facets: false` -- the sidebar is already on screen and does not change as more products load.
 *
 * ponytail: no cache headers. Shopify is behind `revalidate`, and page 2 of an infinite scroll is
 * not something a second visitor asks for.
 */
export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const handle = params.get("handle");
  const cursor = params.get("cursor");
  if (!handle || !cursor) return Response.json({ products: [], pageInfo: null }, { status: 400 });

  const search = new URLSearchParams(params);
  search.delete("handle");
  search.delete("cursor");

  const page = await getCollection({ handle, search: search.toString(), cursor, withFacets: false });
  if (!page) return Response.json({ products: [], pageInfo: null }, { status: 404 });

  return Response.json({ products: page.products, pageInfo: page.pageInfo });
}
