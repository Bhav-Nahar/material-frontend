"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/utils/formatPrice";

/**
 * "View similar" -- Lucira's drawer, opened from a product card's corner icon and the PDP gallery's
 * "Similar items" pill. Rises from the bottom on every screen, as theirs does: the shopper stays on
 * the page they were browsing and the alternatives come up over it.
 *
 * The products are fetched when the drawer OPENS, not with the page (see getSimilar), and kept for
 * the life of the component, so closing and reopening does not ask again.
 *
 * Tiles, not ProductCards: a card is a swipeable gallery with a wishlist heart and a rating row,
 * and twelve of those in a drawer is a second listing page. A tile is one photograph, the name and
 * the price the card would show -- per sq ft where Shopify gives one -- and a way through.
 */
export default function SimilarSheet({ productId, title, open, onOpenChange }) {
  const [products, setProducts] = useState(null); // null = not fetched yet

  useEffect(() => {
    if (!open || products) return;
    let cancelled = false;
    fetch(`/api/similar?id=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setProducts(d.products ?? []))
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [open, products, productId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The stock close button is drawn under the sticky header, which covered it -- so the cross
          lives IN the header, where it stays visible however far the grid has scrolled. */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-lg"
      >
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-line bg-background px-5 py-4 lg:px-10">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm font-medium uppercase tracking-wide text-ink">
              View similar
            </SheetTitle>
            {title && <p className="mt-0.5 truncate text-xs text-subtle">to {title}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="-m-1.5 shrink-0 cursor-pointer rounded-sm p-1.5 text-ink transition-colors hover:bg-paper"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-5 pb-8 pt-5 lg:px-10">
          {products === null ? (
            <ul className="grid animate-pulse grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i}>
                  <div className="aspect-swatch w-full rounded-sm bg-line" />
                  <div className="mt-3 h-3.5 w-4/5 bg-line" />
                  <div className="mt-2 h-3.5 w-2/5 bg-line opacity-60" />
                </li>
              ))}
            </ul>
          ) : products.length === 0 ? (
            <p className="py-10 text-center text-sm text-subtle">
              Nothing similar yet — we&rsquo;re adding more every week.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6">
              {products.map((p) => (
                <li key={p.handle}>
                  <Link
                    href={`/products/${p.handle}`}
                    onClick={() => onOpenChange(false)}
                    className="group block"
                  >
                    <div className="relative aspect-swatch w-full overflow-hidden rounded-sm border border-line bg-paper">
                      {p.images?.[0] && (
                        <Image
                          src={p.images[0]}
                          alt={p.alt ?? ""}
                          fill
                          sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <p className="mt-2.5 line-clamp-2 text-sm leading-snug text-ink">{p.title}</p>
                    <p className="num mt-1 text-sm font-medium text-ink">
                      ₹{formatPrice(p.price)}
                      {p.unit && <span className="text-xs font-normal text-subtle">/{p.unit}</span>}
                      {p.comparePrice > p.price && (
                        <span className="ml-1.5 text-xs font-normal text-meta line-through">
                          ₹{formatPrice(p.comparePrice)}
                        </span>
                      )}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wide text-ink underline-offset-4 group-hover:underline">
                      View details <ChevronRight size={12} strokeWidth={2} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
