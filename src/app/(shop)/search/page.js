import Link from "next/link";
import { BookOpen, FileText, SearchX } from "lucide-react";

import CollectionPage from "../collections/[handle]/CollectionPage";
import { getSearch } from "@/lib/collection";
import { predictiveSearch } from "@/lib/products";
import { SEARCH_SORTS } from "@/lib/sorts";

/**
 * Full search results — the page Enter and "View All Results" land on.
 *
 * Rendered BY CollectionPage (2026-10-19), so search has the collection page's filters, sort,
 * chips, mobile Filter/Sort bar, counts and scroll-to-load rather than a thinner copy of them.
 * getSearch is Shopify's full search() -- every match, not predictive search's 10 -- reading the
 * same filter params from the URL; `q` rides along with them.
 *
 * Collections and guides still come from predictiveSearch: there are only ever a few, and it is
 * the call that returns them. Collections sit above the grid (a shopper typing "marble" most wants
 * the marble shelf); guides below it.
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
  const params = await searchParams;
  const query = String(params.q ?? "").trim();
  const search = new URLSearchParams(params).toString();

  const [found, result] =
    query.length >= 2
      ? await Promise.all([predictiveSearch(query, 10), getSearch({ query, search })])
      : [null, null];

  const collections = found?.collections ?? [];
  const content = [
    ...(found?.articles ?? []).map((a) => ({ ...a, href: `/blog/${a.handle}`, kind: "Guide" })),
    ...(found?.pages ?? []).map((p) => ({ ...p, href: `/pages/${p.handle}`, kind: "Page" })),
  ];
  // Filters applied and nothing left is CollectionPage's own empty state ("Clear all filters").
  // No products for the TERM itself is this page's: suggest somewhere to go instead.
  const filtered = [...new URLSearchParams(search).keys()].some((k) => k !== "q");
  const nothing = !result || (result.products.length === 0 && !filtered);

  if (!query || (nothing && collections.length === 0 && content.length === 0)) {
    return <Empty query={query} />;
  }

  return (
    <>
      {nothing ? (
        <div className="container-main mt-6 lg:mt-8">
          <h1 className="font-display text-xl tracking-[-0.02em] text-ink lg:text-2xl">
            Results for <span className="text-action-ink">&ldquo;{query}&rdquo;</span>
          </h1>
          <CollectionLinks collections={collections} />
        </div>
      ) : (
        <CollectionPage
          key={query}
          title={`“${query}”`}
          crumb="Search"
          sort={result.sort}
          sorts={SEARCH_SORTS}
          products={result.products}
          facets={result.facets}
          pageInfo={result.pageInfo}
          totalCount={result.totalCount}
          apiPath="/api/search"
          list="search"
          intro={<CollectionLinks collections={collections} />}
        />
      )}

      {content.length > 0 && (
        <section className="container-main mt-10 pb-16">
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
    </>
  );
}

function CollectionLinks({ collections }) {
  if (collections.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
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
  );
}

/** A dead end after typing is where a search session becomes a bounce -- always offer a way on. */
function Empty({ query }) {
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
    </main>
  );
}
