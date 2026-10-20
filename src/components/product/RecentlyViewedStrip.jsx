"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useHasMounted } from "@/hooks/useHasMounted";
import { clearRecentlyViewed } from "@/redux/features/recentlyViewed/recentlyViewedSlice";
import { formatPrice } from "@/utils/formatPrice";

/**
 * "Recently viewed" INSIDE a listing grid -- Lucira's in-grid block (2026-10-20): a full-width
 * tinted panel that breaks up a long grid and hands a returning shopper straight back to what they
 * were weighing up, without leaving the listing.
 *
 * Compact tiles, not ProductCards: twelve full cards (galleries, hearts, rating rows) inside a
 * grid of cards would read as more of the grid. A tile is the photo, the name on one line and the
 * price the card would show, in a row that swipes on a phone and has arrows on a desktop.
 *
 * Renders nothing for a first visit (no trail), on the server and on the first client pass (the
 * trail lives in localStorage -- see RecentlyViewed for why both guards are needed), so it never
 * shifts the grid on arrival. `exclude` leaves out a product already on screen.
 */
export default function RecentlyViewedStrip({ exclude = null, className = "" }) {
  const dispatch = useDispatch();
  const hasMounted = useHasMounted();
  const rehydrated = useSelector((state) => state._persist?.rehydrated);
  const trail = useSelector((state) => state.recentlyViewed.products);
  const rail = useRef(null);

  const products = trail.filter((p) => p.handle !== exclude);
  if (!hasMounted || !rehydrated || products.length === 0) return null;

  const scroll = (dir) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section
      aria-label="Recently viewed"
      className={`col-span-full rounded-sm bg-[#f1ece4] px-4 py-5 lg:px-6 lg:py-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-ink">Recently viewed</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => dispatch(clearRecentlyViewed())}
            className="mr-1 cursor-pointer text-[11px] text-subtle underline-offset-4 hover:text-ink hover:underline"
          >
            Clear
          </button>
          {products.length > 4 && (
            <>
              <button
                type="button"
                onClick={() => scroll(-1)}
                aria-label="Scroll recently viewed back"
                className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:border-ink lg:flex"
              >
                <ChevronLeft size={15} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => scroll(1)}
                aria-label="Scroll recently viewed forward"
                className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:border-ink lg:flex"
              >
                <ChevronRight size={15} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </div>

      <ul
        ref={rail}
        className="no-scrollbar -mx-4 mt-3.5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 lg:-mx-0 lg:gap-4 lg:px-0"
      >
        {products.map((p) => (
          <li key={p.handle} className="w-[38%] shrink-0 snap-start sm:w-[24%] lg:w-[17%] xl:w-[14%]">
            <Link href={`/products/${p.handle}`} className="group block">
              <div className="relative aspect-swatch overflow-hidden rounded-sm border border-line bg-surface">
                {p.images?.[0] && (
                  <Image
                    src={p.images[0]}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 160px, 38vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="mt-2 truncate text-xs text-ink">{p.title}</p>
              <p className="num mt-0.5 text-xs font-medium text-ink">
                ₹{formatPrice(p.price)}
                {p.unit && <span className="font-normal text-subtle">/{p.unit}</span>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
