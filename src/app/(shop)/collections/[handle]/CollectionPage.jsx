"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, ListFilter, SlidersHorizontal, X } from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { OPEN_MOBILE_MENU } from "@/lib/events";
import {
  MAX_RESTORE_PAGES,
  plpUrlKey,
  readPlpState,
  readRememberedProduct,
  restoreListingScroll,
  savePlpState,
} from "@/lib/plpScroll";
import { SORTS } from "@/lib/sorts";
import { formatPrice } from "@/utils/formatPrice";

/**
 * The collection page's interactive shell.
 *
 * Every facet and the sort live in the URL. Changing one is `router.push`, which re-runs the
 * server component -- so there is no client-side filter state to keep in step with the server, no
 * second "apply the filters we just fetched" round trip, and a filtered page is a link you can
 * send someone.
 *
 * DESKTOP is the arrangement the brief settled on and is unchanged: sticky sidebar of facets on
 * the left, count and a sort <select> above the grid.
 *
 * MOBILE follows CaratLane, measured on their live rings page at 390px: a full-width bar pinned to
 * the bottom of the grid with three equal segments -- CATEGORIES | SORT | FILTER -- rather than the
 * jewelry build's floating two-button pill. Categories is the one that is genuinely missing from
 * the jewelry build: on a phone the mega menu is three taps away, so the sheet that lets a shopper
 * jump to another category (or into a facet of this one) is doing navigation work the sidebar does
 * on desktop.
 *
 * ALSO THE SEARCH PAGE (2026-10-19). /search passes no handle, its own `sorts` (search can only
 * sort by relevance and price), `apiPath="/api/search"` for scroll-to-load, a `list` name for
 * analytics, and `intro` for the collection links above the grid. The search term rides in the URL
 * as `q`, so every filter link, the next-page fetch and "Clear all" carry it like any other param.
 */
export default function CollectionPage({
  handle,
  title,
  sort,
  products,
  facets,
  pageInfo,
  totalCount,
  priorityCards = 4,
  sorts = SORTS,
  apiPath = "/api/collection",
  list = `collection:${handle}`,
  crumb = title,
  intro = null,
}) {
  const DEFAULT_SORT = sorts[0].value;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [sheet, setSheet] = useState(null); // "sort" | "filter" | null
  const [openFacets, setOpenFacets] = useState(() => facets.slice(0, 3).map((f) => f.id));
  const [mobileFacet, setMobileFacet] = useState(facets[0]?.id ?? null);

  /* ---------------------------------------------------------------- URL state */

  const navigate = useCallback(
    (params) => {
      const query = params.toString();
      startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  const isChecked = (facetId, label) => searchParams.getAll(facetId).includes(label);

  // Repeated params, not a comma-joined string: Shopify ORs values within one facet and ANDs
  // across facets, and one key per value is what makes that mapping direct.
  const toggleValue = (facetId, label) => {
    const params = new URLSearchParams(searchParams);
    const current = params.getAll(facetId);
    const next = current.includes(label)
      ? current.filter((v) => v !== label)
      : [...current, label];
    params.delete(facetId);
    next.forEach((v) => params.append(facetId, v));
    navigate(params);
  };

  const setPrice = ([min, max], bounds) => {
    const params = new URLSearchParams(searchParams);
    // Only record an end that has actually moved -- an untouched slider must not narrow anything.
    if (min > bounds.min) params.set("price.gte", String(min));
    else params.delete("price.gte");
    if (max < bounds.max) params.set("price.lte", String(max));
    else params.delete("price.lte");
    navigate(params);
  };

  const setSort = (value) => {
    const params = new URLSearchParams(searchParams);
    if (value === DEFAULT_SORT) params.delete("sort");
    else params.set("sort", value);
    navigate(params);
  };

  // Filters and sort go; the search term, on /search, stays -- clearing filters is not a new search.
  const clearAll = () => {
    const keep = new URLSearchParams();
    if (searchParams.get("q")) keep.set("q", searchParams.get("q"));
    navigate(keep);
  };

  // Every applied facet, as chips. Read off the URL rather than tracked separately, so a shopper
  // who lands on a filtered link sees the same chips as one who clicked their way there.
  const applied = [];
  for (const facet of facets) {
    if (facet.type === "PRICE_RANGE") continue;
    for (const value of facet.values) {
      if (isChecked(facet.id, value.label)) {
        applied.push({ facetId: facet.id, label: value.label, group: facet.label });
      }
    }
  }
  const priceMin = Number(searchParams.get("price.gte")) || null;
  const priceMax = Number(searchParams.get("price.lte")) || null;
  const priceApplied = priceMin != null || priceMax != null;
  const appliedCount = applied.length + (priceApplied ? 1 : 0);

  /* -------------------------------------------------------- scroll to load more */

  const [loaded, setLoaded] = useState([]);
  const [page, setPage] = useState(pageInfo);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef(null);
  const grid = useRef(null);
  const busy = useRef(false);
  // How many pages scrolling has appended, saved on the way out so the way back can replay them.
  const pagesLoaded = useRef(0);

  // A new server render is a new first page: drop whatever scrolling had appended.
  useEffect(() => {
    setLoaded([]);
    setPage(pageInfo);
    pagesLoaded.current = 0;
  }, [products, pageInfo]);

  const loadMore = useCallback(async () => {
    if (busy.current || !page?.hasNextPage) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(searchParams);
      if (handle) params.set("handle", handle);
      params.set("cursor", page.endCursor);
      const res = await fetch(`${apiPath}?${params}`);
      const next = await res.json();
      if (next.products?.length) {
        setLoaded((prev) => [...prev, ...next.products]);
        pagesLoaded.current += 1;
      }
      setPage(next.pageInfo ?? { hasNextPage: false, endCursor: null });
    } catch {
      // Leave `page` as it is: the sentinel stays observed, so scrolling past it tries again.
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [apiPath, handle, page, searchParams]);

  /* -------------------------------------------------------------- coming back here */

  /**
   * Replay the pages that were on screen when this page was left, then put the opened card back
   * under the shopper's eyes. Runs once per mount and does nothing at all on a first visit.
   *
   * Declared ABOVE the observer effect on purpose: effects run in order, so `busy` is already
   * claimed by the time the observer is attached. Without that the observer fetches from the same
   * cursor this loop is walking and the grid ends up holding every replayed page twice.
   *
   * The pages go in with ONE setState so the grid grows in a single layout pass -- appending them
   * one at a time jolts the viewport once per page while the shopper is trying to read it.
   */
  useEffect(() => {
    const url = plpUrlKey();
    const saved = readPlpState(url);
    if (!saved) return;

    const wanted = Math.min(saved.pages ?? 0, MAX_RESTORE_PAGES);
    const openedProduct = readRememberedProduct(url);
    const replaying = wanted > 0 && pageInfo?.hasNextPage;
    if (replaying) busy.current = true;

    let cancelled = false;
    (async () => {
      const extra = [];
      let next = pageInfo;
      let pages = 0;
      try {
        for (let i = 0; i < wanted && next?.hasNextPage && !cancelled; i++) {
          const params = new URLSearchParams(searchParams);
          if (handle) params.set("handle", handle);
          params.set("cursor", next.endCursor);
          const res = await fetch(`${apiPath}?${params}`);
          const data = await res.json();
          if (cancelled) return;
          next = data.pageInfo ?? { hasNextPage: false, endCursor: null };
          if (!data.products?.length) break;
          extra.push(...data.products);
          pages += 1;
          // Their card is here -- there is nothing to gain from paying for the pages past it.
          if (openedProduct && extra.some((p) => p.handle === openedProduct)) break;
        }
      } catch {
        // Restore is a nicety. Whatever arrived is still worth showing, and scrolling to the card
        // below simply misses and lands at the top of the grid instead.
      }
      if (cancelled) return;
      if (extra.length) {
        setLoaded(extra);
        setPage(next);
        pagesLoaded.current = pages;
      }
      busy.current = false;
      restoreListingScroll({
        url,
        productHandle: openedProduct,
        scrollY: saved.scrollY ?? 0,
        gridEl: grid.current,
      });
    })();

    return () => {
      cancelled = true;
      busy.current = false;
    };
    // Once per mount: the collection, its filters and its first cursor are all fixed for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Save on the way out.
   *
   * `pagehide` rather than `unload` alone: it fires when the page goes into the back/forward cache
   * too, which is what iOS Safari uses for a swipe-back -- the case this whole thing exists for, and
   * the one where the component is never unmounted and no cleanup would ever run.
   */
  useEffect(() => {
    const url = plpUrlKey();
    const save = () => savePlpState(url, { scrollY: window.scrollY, pages: pagesLoaded.current });
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
      window.removeEventListener("beforeunload", save);
    };
  }, [pathname, searchParams]);

  /**
   * ONE sentinel, ONE ref.
   *
   * The jewelry build binds `loadMoreRef` to two different nodes -- a product 15 from the end AND
   * the div below the grid -- so which one the observer ends up watching depends on React's commit
   * order. On the live site it watches neither: the rings PLP loads 25 of 976 products and never
   * paginates however far you scroll.
   */
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !page?.hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "800px" }, // start fetching a screen early, so the grid does not visibly stall
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, loadMore]);

  /* ---------------------------------------------------------------- rendering */

  const all = [...products, ...loaded];
  const count =
    totalCount != null ? totalCount : page?.hasNextPage ? `${all.length}+` : all.length;

  return (
    // Bottom padding clears the pinned mobile bar, so the last row of products is never half
    // hidden behind it. Nothing is pinned on desktop, hence the smaller value there.
    <div className="pb-28 lg:pb-16">
      <div className="container-main">
        {/* Same tightening as the PDP crumb -- see the note there. */}
        <nav aria-label="Breadcrumb" className="py-1.5 text-[11px] text-subtle lg:py-3">
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>
          <span className="px-1.5 text-meta">/</span>
          <span className="text-ink">{crumb}</span>
        </nav>

        <div className="flex items-baseline gap-3 border-b border-line pb-4">
          <h1 className="font-display text-2xl tracking-[-0.02em] lg:text-3xl">{title}</h1>
          <span className="num text-xs text-subtle">
            {count} {count === 1 ? "product" : "products"}
          </span>
        </div>
        {intro}
      </div>

      <div className="container-main mt-6 flex gap-10">
        {/* ============================== DESKTOP SIDEBAR ============================== */}
        <aside className="hidden w-60 shrink-0 lg:block xl:w-68">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-ink">Filters</h2>
              {appliedCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="cursor-pointer text-[11px] uppercase tracking-wide text-subtle hover:text-ink"
                >
                  Clear all
                </button>
              )}
            </div>

            {facets.length === 0 && (
              <p className="py-4 text-xs text-subtle">No filters here yet.</p>
            )}

            {facets.map((facet) => {
              const open = openFacets.includes(facet.id);
              return (
                <div key={facet.id} className="border-b border-line">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFacets((prev) =>
                        open ? prev.filter((id) => id !== facet.id) : [...prev, facet.id],
                      )
                    }
                    className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-sm text-ink"
                  >
                    {facet.label}
                    <ChevronDown
                      size={15}
                      strokeWidth={1.5}
                      className={`text-subtle transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="pb-4">
                      {facet.type === "PRICE_RANGE" ? (
                        <PriceFacet
                          facet={facet}
                          min={priceMin}
                          max={priceMax}
                          onCommit={setPrice}
                        />
                      ) : (
                        <ul className="space-y-2.5">
                          {facet.values.map((value) => (
                            <li key={value.id}>
                              <Checkbox
                                checked={isChecked(facet.id, value.label)}
                                onChange={() => toggleValue(facet.id, value.label)}
                                label={value.label}
                                count={value.count}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ================================= PRODUCTS ================================= */}
        <section className="min-w-0 flex-1">
          <div className="hidden items-center justify-between border-b border-line pb-3 lg:flex">
            <span className="num text-xs text-subtle">
              Showing {all.length} of {count}
            </span>
            <label className="flex items-center gap-2 text-xs text-subtle">
              Sort by
              <span className="relative flex items-center">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent pr-5 text-sm text-ink focus:outline-none"
                >
                  {sorts.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute right-0 text-ink"
                />
              </span>
            </label>
          </div>

          {appliedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 py-3">
              {applied.map((chip) => (
                <Chip
                  key={`${chip.facetId}-${chip.label}`}
                  onRemove={() => toggleValue(chip.facetId, chip.label)}
                >
                  {chip.label}
                </Chip>
              ))}
              {priceApplied && (
                <Chip
                  onRemove={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete("price.gte");
                    params.delete("price.lte");
                    navigate(params);
                  }}
                >
                  ₹{formatPrice(priceMin ?? 0)} – {priceMax ? `₹${formatPrice(priceMax)}` : "any"}
                </Chip>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer text-xs text-action-ink underline underline-offset-4"
              >
                Clear all
              </button>
            </div>
          )}

          {all.length === 0 ? (
            <div className="border border-line bg-surface px-6 py-16 text-center">
              <p className="text-sm text-ink">Nothing matches these filters.</p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-3 cursor-pointer text-sm text-action-ink underline underline-offset-4"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div
              ref={grid}
              className={`grid-products gap-x-4 gap-y-8 transition-opacity lg:gap-x-6 ${
                pending ? "opacity-50" : ""
              }`}
            >
              {all.map((product, i) => (
                <ProductCard
                  key={`${product.handle}-${i}`}
                  product={product}
                  priority={i < priorityCards}
                  list={list}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* The observed node. Tall enough to cross the viewport at any scroll speed. */}
          <div ref={sentinel} className="flex h-20 items-center justify-center">
            {loadingMore && <span className="text-xs text-subtle">Loading more…</span>}
            {!page?.hasNextPage && all.length > 0 && (
              <span className="text-[11px] uppercase tracking-wide text-meta">
                That is everything
              </span>
            )}
          </div>

        </section>
      </div>

      {/* ============================== MOBILE ACTION BAR ==============================
          Pinned to the viewport for the whole page, as CaratLane's is -- it is the only way to
          reach sort and filter once the shopper is fifty products deep, so it must not scroll
          away with the grid. The page's own bottom padding keeps the last row clear of it. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-stretch bg-ink text-white lg:hidden">
        {/* Categories opens the header's menu rather than a second copy of it -- same list, one
            place to maintain, and the shopper gets the full navigation they already know. */}
        <BarButton
          icon={LayoutGrid}
          label="Categories"
          onClick={() => window.dispatchEvent(new Event(OPEN_MOBILE_MENU))}
        />
        <BarButton icon={ListFilter} label="Sort" onClick={() => setSheet("sort")} />
        <BarButton
          icon={SlidersHorizontal}
          label="Filter"
          badge={appliedCount}
          onClick={() => setSheet("filter")}
        />
      </div>

      {/* ================================ MOBILE SHEETS ================================ */}

      <BottomSheet open={sheet === "sort"} onClose={() => setSheet(null)} title="Sort by">
        <ul>
          {sorts.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => {
                  setSort(option.value);
                  setSheet(null);
                }}
                className={`flex w-full cursor-pointer items-center justify-between py-3.5 text-left text-sm ${
                  sort === option.value ? "text-action-ink" : "text-ink"
                }`}
              >
                {option.label}
                {sort === option.value && <Check size={16} strokeWidth={1.75} />}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      {/* Group rail on the left, that group's values on the right -- CaratLane's arrangement, and
          theirs. It is what keeps ten facets reachable without a page of scrolling. */}
      <BottomSheet
        open={sheet === "filter"}
        onClose={() => setSheet(null)}
        title="Filters"
        full
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={clearAll}
              className="cursor-pointer border border-line-strong py-3 text-xs uppercase tracking-wide text-ink"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="cursor-pointer bg-action py-3 text-xs uppercase tracking-wide text-on-action"
            >
              Show {count} {count === 1 ? "result" : "results"}
            </button>
          </div>
        }
      >
        {facets.length === 0 ? (
          <p className="py-6 text-sm text-subtle">No filters here yet.</p>
        ) : (
          <div className="-mx-5 flex h-full">
            <ul className="w-2/5 shrink-0 overflow-y-auto border-r border-line bg-paper">
              {facets.map((facet) => {
                const active = mobileFacet === facet.id;
                const chosen =
                  facet.type === "PRICE_RANGE"
                    ? Number(priceApplied)
                    : facet.values.filter((v) => isChecked(facet.id, v.label)).length;
                return (
                  <li key={facet.id}>
                    <button
                      type="button"
                      onClick={() => setMobileFacet(facet.id)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-1 px-5 py-3.5 text-left text-sm ${
                        active
                          ? "border-l-2 border-action bg-surface pl-[18px] text-ink"
                          : "text-subtle"
                      }`}
                    >
                      {facet.label}
                      {chosen > 0 && (
                        <span className="num flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] text-white">
                          {chosen}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {facets
                .filter((facet) => facet.id === mobileFacet)
                .map((facet) =>
                  facet.type === "PRICE_RANGE" ? (
                    <div key={facet.id} className="py-4">
                      <PriceFacet
                        facet={facet}
                        min={priceMin}
                        max={priceMax}
                        onCommit={setPrice}
                      />
                    </div>
                  ) : (
                    <ul key={facet.id} className="space-y-1">
                      {facet.values.map((value) => (
                        <li key={value.id} className="py-2">
                          <Checkbox
                            checked={isChecked(facet.id, value.label)}
                            onChange={() => toggleValue(facet.id, value.label)}
                            label={value.label}
                            count={value.count}
                          />
                        </li>
                      ))}
                    </ul>
                  ),
                )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/* -------------------------------------------------------------------------- pieces */

function BarButton({ icon: Icon, label, badge = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 cursor-pointer items-center justify-center gap-2 border-l border-white/15 py-3.5 text-xs uppercase tracking-wide first:border-l-0"
    >
      <Icon size={15} strokeWidth={1.5} />
      {label}
      {badge > 0 && (
        <span className="num flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] text-on-action">
          {badge}
        </span>
      )}
    </button>
  );
}

function Checkbox({ checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      {/* peer/peer-focus-visible: the real input is sr-only, so without this the painted box
          shows nothing when the checkbox is focused from the keyboard. */}
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border peer-focus-visible:ring-2 peer-focus-visible:ring-action ${
          checked ? "border-action bg-action" : "border-line-strong bg-surface"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-on-action" />}
      </span>
      <span className={checked ? "text-ink" : "text-subtle"}>{label}</span>
      <span className="num ml-auto text-[11px] text-meta">{count}</span>
    </label>
  );
}

function Chip({ children, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex cursor-pointer items-center gap-1.5 border border-line-strong bg-surface px-2.5 py-1 text-xs text-ink"
    >
      {children}
      <X size={12} strokeWidth={1.75} className="text-subtle" />
    </button>
  );
}

/**
 * Price is committed on release rather than on drag: every change is a navigation, and pushing one
 * per pixel of thumb travel would queue a request per frame.
 */
function PriceFacet({ facet, min, max, onCommit }) {
  const bounds = { min: Math.floor(facet.min), max: Math.ceil(facet.max) };
  const [range, setRange] = useState([min ?? bounds.min, max ?? bounds.max]);

  useEffect(() => {
    setRange([min ?? bounds.min, max ?? bounds.max]);
  }, [min, max, bounds.min, bounds.max]);

  return (
    <div className="space-y-3 px-1">
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={Math.max(1, Math.round((bounds.max - bounds.min) / 100))}
        value={range}
        onValueChange={setRange}
        onValueCommit={(next) => onCommit(next, bounds)}
      />
      <p className="num text-center text-xs text-subtle">
        ₹{formatPrice(range[0])} – ₹{formatPrice(range[1])}
      </p>
    </div>
  );
}

/** One bottom sheet, three uses. radix is already carried for the mobile menu and category sheet. */
function BottomSheet({ open, onClose, title, children, footer, full = false }) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        showCloseButton={false}
        className={`gap-0 p-0 ${full ? "h-[85dvh]" : "max-h-[80dvh]"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <SheetTitle className="font-display text-base tracking-[-0.02em]">{title}</SheetTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 cursor-pointer p-1 text-subtle hover:text-ink"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>

        {footer && (
          <div className="border-t border-line px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
