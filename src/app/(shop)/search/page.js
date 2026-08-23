import Link from "next/link";
import { BookOpen, FileText, SearchX } from "lucide-react";

import ProductCard from "@/components/product/ProductCard";
import { predictiveSearch } from "@/lib/products";

/**
 * Full search results — the page Enter and "View All Results" land on.
 *
 * BOTH HEADERS ALREADY LINKED HERE; the route did not exist, so the single most common search
 * gesture (type, press Enter) 404'd sitewide. This page is that missing landing.
 *
 * ponytail: one predictiveSearch call with a higher per-type limit, not Shopify's paginated
 * search() connection. Predictive search carries the Search & Discovery app's synonyms and rules,
 * returns products/collections/articles/pages in ONE request, and its products come through
 * mapProducts — so a result card and a shelf card can never disagree. Move to search() with
 * pagination when the catalogue outgrows 20 results a term.
 */

export const revalidate = 300;

export async function generateMetadata({ searchParams }) {
  const { q = "" } = await searchParams;
  return {
    title: q ? `Search: ${q} — Material` : "Search — Material",
    // Search results are for the searcher, not the index.
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }) {
  const { q = "" } = await searchParams;
  const query = String(q).trim();
  const found = query.length >= 2 ? await predictiveSearch(query, 20) : null;

  const products = found?.products ?? [];
  const collections = found?.collections ?? [];
  const content = [
    ...(found?.articles ?? []).map((a) => ({ ...a, href: `/blog/${a.handle}`, kind: "Guide" })),
    ...(found?.pages ?? []).map((p) => ({ ...p, href: `/pages/${p.handle}`, kind: "Page" })),
  ];
  const nothing = products.length === 0 && collections.length === 0 && content.length === 0;

  return (
    <main className="container-main mt-6 pb-16 lg:mt-8 lg:pb-24">
      <h1 className="font-display text-xl tracking-[-0.02em] text-ink lg:text-2xl">
        {query ? (
          <>
            Results for <span className="text-action-ink">&ldquo;{query}&rdquo;</span>
          </>
        ) : (
          "Search"
        )}
      </h1>

      {/* Collections first — a shopper typing "marble" most wants the marble shelf, not six
          individual boxes of it. Same ordering as the header popup. */}
      {collections.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {collections.map((c) => (
            <li key={c.handle}>
              <Link
                href={`/collections/${c.handle}`}
                className="block border border-line-strong bg-surface px-4 py-2 text-sm text-ink transition-colors hover:border-ink"
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {products.length > 0 && (
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
          {products.map((product, i) => (
            <ProductCard
              key={product.handle}
              product={product}
              priority={i < 4}
              list="search"
              index={i}
            />
          ))}
        </div>
      )}

      {content.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-ink">Guides &amp; pages</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {content.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 text-sm text-subtle underline-offset-4 hover:text-ink hover:underline"
                >
                  {item.kind === "Guide" ? (
                    <BookOpen size={14} strokeWidth={1.6} className="shrink-0 text-meta" />
                  ) : (
                    <FileText size={14} strokeWidth={1.6} className="shrink-0 text-meta" />
                  )}
                  {item.title}
                  <span className="text-xs text-meta">{item.kind}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The empty state still has to be a way forward — a dead end after typing is where a search
          session becomes a bounce. */}
      {(nothing || !query) && (
        <div className="mt-12 flex flex-col items-center py-8 text-center">
          <SearchX size={26} strokeWidth={1.25} className="text-line-strong" aria-hidden="true" />
          <p className="mt-4 text-sm text-subtle">
            {query
              ? `Nothing matched "${query}". Try a material, a room, or a finish.`
              : "Type in the search box above to look across products, collections and guides."}
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { label: "Tiles", href: "/collections/tiles" },
              { label: "Laminates", href: "/collections/laminates" },
              { label: "Wallpaper", href: "/collections/wallpaper" },
            ].map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className="block border border-line-strong bg-surface px-4 py-2 text-sm text-ink transition-colors hover:border-ink"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
