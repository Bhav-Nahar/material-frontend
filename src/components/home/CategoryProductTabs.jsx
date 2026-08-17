"use client";

import { useState } from "react";
import ProductRail from "@/components/product/ProductRail";

const ALL = "All";

/**
 * Look tabs over a product rail. The jewelry build's CollectionSection tab design: a horizontally
 * scrolling row of plain text, the active one marked by a 2px bar beneath it -- no pills, which is
 * also what §06 wants. GlassQuick uses outlined chips for the same job; the underline is quieter
 * next to product photography and needs no border of its own.
 *
 * The jewelry build refetches the collection on every tab change, through an /api/collection route.
 * We have no such route, and the whole shelf is 24 products, so this filters what is already here
 * -- the tab switch is instant and costs no request.
 *
 * ponytail: plain useState, no URL state. Tabs are a browse aid on the homepage, not a destination
 * worth deep-linking; the collection page is that.
 */
export default function CategoryProductTabs({ products, tabs = [] }) {
  const [active, setActive] = useState(ALL);

  // One tab is no choice at all -- render the rail on its own.
  const options = tabs.length > 1 ? [ALL, ...tabs] : [];

  const shown =
    active === ALL
      ? products
      : products.filter((p) => (p.tags ?? []).some((t) => t.toLowerCase() === active.toLowerCase()));

  return (
    <div>
      {options.length > 0 && (
        <div className="mb-6 flex gap-6 overflow-x-auto no-scrollbar border-b border-line lg:mb-8 lg:gap-8">
          {options.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              aria-pressed={active === tab}
              className={`relative shrink-0 cursor-pointer pb-3 text-sm whitespace-nowrap transition-colors ${
                active === tab ? "text-ink" : "text-subtle hover:text-ink"
              }`}
            >
              {tab}
              {/* -1px so the bar sits ON the container's hairline rather than above it. */}
              {active === tab && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-ink" />}
            </button>
          ))}
        </div>
      )}

      {/* key remounts the Swiper on a tab change: it caches slide widths, so filtering 10 cards
          down to 2 in place left it scrolled into empty space. */}
      <ProductRail key={active} products={shown} list={`rail:category:${active}`} />
    </div>
  );
}
