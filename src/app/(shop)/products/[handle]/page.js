import Link from "next/link";
import { notFound } from "next/navigation";

import { getProduct, getRelated } from "@/lib/product";
import ProductRail from "@/components/product/ProductRail";
import RecentlyViewed from "@/components/product/RecentlyViewed";
import HomeFaqs from "@/components/home/HomeFaqs";
import ShopByCategory from "@/components/home/ShopByCategory";
import WhyMaterial from "@/components/home/WhyMaterial";
import ProductPage from "./ProductPage";

/**
 * The product page (PDP).
 *
 * Renders on the server. ONE Shopify request for the product, one for the rail beneath it, both
 * cached for the page's revalidate window. The browser fetches nothing on load.
 *
 * The jewelry build's equivalent ships a 3,824-line client component that, per view, calls its
 * backend for variant pricing, Shopify again for reviews, a third service for coupons, and a fourth
 * for store stock -- before the shopper has touched anything.
 */
export const revalidate = 86400;

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return {};

  const description = product.seo?.description || product.description.slice(0, 160);
  const cheapest = product.variants.reduce(
    (low, v) => (v.price < low.price ? v : low),
    product.variants[0],
  );

  return {
    title: product.seo?.title || `${product.title} | Material`,
    description,
    alternates: { canonical: `/products/${handle}` },
    openGraph: {
      title: product.seo?.title || product.title,
      description,
      images: product.media[0] ? [product.media[0].url] : [],
      type: "website",
    },
    // Shopify prices in paise-free decimals; Google wants the pack price, which is what is charged.
    other: cheapest ? { "product:price:amount": String(cheapest.price) } : undefined,
  };
}

export default async function Page({ params }) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const related = await getRelated(product.collection?.handle, product.handle);

  return (
    <>
      {/* Product and BreadcrumbList, from the same data the page renders -- not a second,
          hand-maintained copy. That build keeps its schema in lib/seo.js, where the offer price
          is read off a field the PDP no longer uses. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema(product)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(product)) }}
      />

      <div className="container-main">
        {/* Tighter on a phone: 12px of air above and below an 11px caption is most of a line of
            text spent on a row nobody came for, and it pushes the photograph down the fold. The
            desktop value stands -- there the crumb sits in a wide, calm header band. */}
        <nav aria-label="Breadcrumb" className="flex items-center py-1.5 text-[11px] text-subtle lg:py-3">
          <Link href="/" className="shrink-0 underline-offset-4 hover:underline">
            Home
          </Link>
          {product.collection && (
            <>
              <span className="shrink-0 px-1.5 text-meta">/</span>
              <Link
                href={`/collections/${product.collection.handle}`}
                className="shrink-0 underline-offset-4 hover:underline"
              >
                {product.collection.title}
              </Link>
            </>
          )}
          <span className="shrink-0 px-1.5 text-meta">/</span>
          {/* Truncated on ONE line, as Material Depot's is -- these titles run past twenty words.
              `truncate`, not `line-clamp-1`: line-clamp sets display:-webkit-box, which would override
              the block layout truncation needs. The fx-max-everything fixture is what showed it.

              A FLEX ROW rather than the inline run this used to be, with the crumbs pinned by
              `shrink-0` and only the title allowed to give: a `max-w-[55vw]` title was still an
              inline box that could not fit beside "Home / Tiles /" on a 390px phone, so it wrapped
              anyway and the crumb stood 47px tall -- two lines of chrome above the photograph. As a
              flex item the title takes whatever width is left and truncates into it, at any screen
              size, so no max width has to be guessed. `min-w-0` is what lets it shrink past its own
              text: a flex item's `min-width: auto` would otherwise refuse. */}
          <span className="min-w-0 truncate text-ink">{product.title}</span>
        </nav>
      </div>

      <ProductPage product={product} />

      {/* FLUSH against the detail panels above it -- no margin. The panels end without a bottom rule
          (see last:border-b-0 in ProductDetails) and this strip carries its own border-t, so the two
          meet on ONE hairline and the strip reads as the list's closing edge. It follows the panels in
          normal flow, so opening one simply pushes the strip down; nothing here is pinned or measured. */}
      <WhyMaterial />

      {related.length > 0 && (
        <section className="container-main mt-6 lg:mt-8">
          <h2 className="font-display text-lg tracking-[-0.02em] lg:text-xl">
            More from {product.collection?.title ?? product.category}
          </h2>
          <div className="mt-4">
            <ProductRail products={related} priorityCount={0} list="rail:related" />
          </div>
        </section>
      )}

      {/* The customer's own research trail -- for tiles, the shelf they actually come back to.
          Renders nothing on a first visit. */}
      <RecentlyViewed product={product} />

      {/* EXPLORE OUR RANGE.
          This is what makes the page not end in a wall. The rail above it is conditional and today
          it renders NOTHING -- `tiles` holds exactly one product, so `getRelated` excludes the one
          being viewed and returns an empty array -- and recently-viewed is empty on a first visit.
          So the PDP's entire below-the-fold was: promises strip, then the footer.

          The honest fix is NAVIGATION, not invented products: the same category block the homepage
          runs, under a heading that suits a product page. It cannot be empty (the categories are
          static) and it cannot lie (nothing here claims a product exists). When the catalogue grows,
          the rail above starts filling and this becomes the second way out rather than the only one. */}
      <div className="mt-6 lg:mt-8">
        <ShopByCategory title="Explore our range" />
      </div>

      {/* The questions a tile buyer asks before paying -- quantities, freight, breakage, returns.
          The SAME list as the homepage: they are the same questions, and a second hand-maintained
          copy would be the one that goes stale. Zero JavaScript (<details>), so a long PDP pays
          nothing for it. */}
      <div className="mt-6 lg:mt-8">
        <HomeFaqs />
      </div>

      {/* NOTE: HelpMeChoose is deliberately NOT here, though it is on the homepage.
          ProductHelp (inside ProductPage, under the specs) now does this job better on a product
          page: it asks about THIS tile and prints the phone number, where the band asks the generic
          "tell us about your space" question that suits someone still browsing. Between the sample
          row, the buy bar's icon, the FAQ's ask-us link and ProductHelp there were already four ways
          to start the same WhatsApp conversation; a fifth is not a funnel, it is noise. */}

      {/* End-of-page clearance. Taller on a phone than a desktop because the pinned buy bar is only
          there below lg, and this is what stops it covering the last section -- the job ProductPage's
          own pb-24 used to do from the middle of the page. */}
      <div className="h-28 lg:h-24" />
    </>
  );
}

/* ---------------------------------------------------------------------- schema */

function productSchema(product) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.media.map((m) => m.url),
    sku: product.variants[0]?.sku ?? undefined,
    brand: product.vendor ? { "@type": "Brand", name: product.vendor } : undefined,
    category: product.category ?? undefined,
    // One offer per variant, priced by the PACK -- that is what Shopify charges. Publishing the
    // per-sq-ft rate here would put a price in Google that no checkout will ever match.
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku ?? undefined,
      name: v.title,
      price: v.price,
      priceCurrency: "INR",
      availability: v.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/BackOrder",
      url: `${site}/products/${product.handle}`,
    })),
  };
}

function breadcrumbSchema(product) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const trail = [
    { name: "Home", url: `${site}/` },
    product.collection && {
      name: product.collection.title,
      url: `${site}/collections/${product.collection.handle}`,
    },
    { name: product.title, url: `${site}/products/${product.handle}` },
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
