"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "@/components/product/ProductCard";

/**
 * The search grid, loading more as you scroll -- the collection page's pattern, so the two
 * behave the same: one sentinel under the grid, observed a screen early, fetching the next page
 * by cursor from /api/search. The first page arrives server-rendered; only later pages are
 * fetched from the browser. The page keys this on the query, so a new search remounts it with
 * empty state rather than resetting it in an effect.
 */
export default function SearchResults({ query, products, pageInfo }) {
  const [loaded, setLoaded] = useState([]);
  const [page, setPage] = useState(pageInfo);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || !page?.hasNextPage) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ q: query, cursor: page.endCursor });
      const next = await (await fetch(`/api/search?${params}`)).json();
      if (next.products?.length) setLoaded((prev) => [...prev, ...next.products]);
      setPage(next.pageInfo ?? { hasNextPage: false, endCursor: null });
    } catch {
      // Keep `page`: the sentinel stays observed, so scrolling past it again retries.
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [query, page]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !page?.hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), {
      rootMargin: "800px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, loadMore]);

  const all = [...products, ...loaded];
  if (all.length === 0) return null;

  return (
    <>
      <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
        {all.map((product, i) => (
          <ProductCard
            key={`${product.handle}-${i}`}
            product={product}
            priority={i < 4}
            list="search"
            index={i}
          />
        ))}
      </div>
      <div ref={sentinel} className="flex h-20 items-center justify-center">
        {loadingMore && <span className="text-xs text-subtle">Loading more…</span>}
        {!page?.hasNextPage && all.length > 8 && (
          <span className="text-[11px] uppercase tracking-wide text-meta">That is everything</span>
        )}
      </div>
    </>
  );
}
