import Link from "next/link";
import { getTopSelling } from "@/lib/products";
import ProductRail from "@/components/product/ProductRail";

/**
 * Top selling products, ranked by Shopify's own BEST_SELLING sort -- not a hand-picked list that
 * goes stale. Same shape as the jewelry build's bestseller section: heading, horizontal rail,
 * shop-all button.
 *
 * The fetch stays on the server so the Storefront token never reaches the browser and the page
 * stays static; only the rail itself is a client component.
 *
 * ponytail: no category tabs. The jewelry build's filter each tab through a backend call we do not
 * have yet.
 */
export default async function TopSelling() {
  const products = await getTopSelling(12);

  // Nothing published yet -- render nothing rather than an empty shelf.
  if (products.length === 0) return null;

  // Tighter above than below: the promises strip closes with a hairline, so its rule plus a full
  // section pad were reading as two stacked gaps.
  // PROVISIONAL -- the brand book's spacing scale has not been applied here yet.
  return (
    <section aria-labelledby="top-selling" className="container-main pt-6 pb-10 lg:pt-8 lg:pb-14">
      <div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
        <h2 id="top-selling" className="text-xl lg:text-2xl">
          Top selling
        </h2>
        <Link
          href="/collections/all"
          prefetch={false}
          className="shrink-0 text-xs font-medium text-action-ink underline decoration-line-strong underline-offset-4 hover:decoration-current lg:text-sm"
        >
          Shop all products
        </Link>
      </div>

      <ProductRail products={products} list="rail:top-selling" />
    </section>
  );
}
