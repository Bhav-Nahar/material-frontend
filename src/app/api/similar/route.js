import { getSimilar } from "@/lib/products";

/**
 * The "View similar" drawer's data -- see getSimilar. ProductCard-shaped products, so the drawer
 * prices them exactly as a card does.
 *
 * Cached at the CDN for an hour: the same product's similar set is the same for every shopper, and
 * the Shopify call behind it is cached for an hour anyway.
 */
export async function GET(request) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const products = await getSimilar(id);
  return Response.json({ products }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
