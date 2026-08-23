"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { ArrowRight, Heart, Loader2, Trash2 } from "lucide-react";

import { gtmItem, pushRemoveFromWishlist } from "@/lib/gtm";
import {
  fetchWishlist,
  removeGuestWishlistItem,
  removeWishlistItem,
} from "@/redux/features/wishlist/wishlistSlice";
import { formatPrice } from "@/utils/formatPrice";

/**
 * Saved items.
 *
 * NO "ADD TO CART" BUTTON. Everything here is a material sold by area -- a tile is bought as
 * "200 sq ft, so 15 boxes", which is a decision the PDP's calculator exists to make. A one-tap add
 * from a saved list would add ONE box, which is the same ₹1,845-instead-of-₹27,668 mistake BuySheet
 * was built to prevent. So the card goes back to the product page, where the quantity gets decided
 * with the area in front of you.
 *
 * The list is whatever the slice holds: the server copy for a signed-in customer, merged with
 * anything saved as a guest at login. This page only reads and removes.
 */
export default function WishlistPage() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.wishlist);
  const user = useSelector((state) => state.user.user);

  useEffect(() => {
    dispatch(fetchWishlist());
  }, [dispatch]);

  const remove = (item) => {
    // Signed in, so the server copy is the one that matters -- but the guest list is still in
    // localStorage and would resurrect the item at the next merge if it were left behind.
    const key = { productId: item.productId, productHandle: item.productHandle, variantId: item.variantId || "" };
    dispatch(removeWishlistItem(key));
    dispatch(removeGuestWishlistItem(key));
    // `handle` is what gtmItem reads; a saved item spells it productHandle.
    pushRemoveFromWishlist(gtmItem({ ...item, handle: item.productHandle }));
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-subtle" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md">
        <p className="text-sm text-subtle">
          Nothing saved yet. Tap the{" "}
          <Heart className="inline size-3.5 align-[-2px]" strokeWidth={1.75} /> on any material to
          keep it here while you decide.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 bg-action px-6 py-3.5 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90"
        >
          Browse materials
          <ArrowRight size={15} strokeWidth={1.75} />
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {items.map((item) => {
        const href = `/products/${item.productHandle || item.productId}`;

        return (
          <li
            key={`${item.productId}-${item.variantId || ""}`}
            className="group relative flex flex-col border border-line bg-surface"
          >
            <Link href={href} prefetch={false} className="relative block aspect-square overflow-hidden bg-paper">
              {item.image && (
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 240px, 45vw"
                  className="object-cover"
                />
              )}
            </Link>

            <div className="flex flex-1 flex-col p-3">
              <Link href={href} prefetch={false}>
                <h2 className="line-clamp-2 text-sm leading-snug text-ink underline-offset-4 hover:underline">
                  {item.title}
                </h2>
              </Link>

              {item.price != null && item.price !== "" && (
                <p className="num mt-1.5 text-sm font-semibold text-ink">
                  ₹{formatPrice(Number(item.price))}
                  {/* The unit the price was saved in — a card saves ₹82/sq ft, the PDP saves
                      ₹1,845/box, and without the suffix the two read as the same kind of number. */}
                  {item.unit ? (
                    <span className="text-xs font-normal text-subtle">/{item.unit}</span>
                  ) : null}
                  {item.comparePrice ? (
                    <span className="num ml-1.5 text-xs font-normal text-meta line-through">
                      ₹{formatPrice(Number(item.comparePrice))}
                    </span>
                  ) : null}
                </p>
              )}

              <Link
                href={href}
                prefetch={false}
                className="mt-auto pt-3 text-xs text-action-ink underline underline-offset-2"
              >
                Choose size and quantity
              </Link>
            </div>

            {/* Top-right, matching where the heart sits on a ProductCard -- the control that put it
                here is the control that takes it away, in the same place. */}
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`Remove ${item.title} from saved items`}
              className="absolute right-2 top-2 flex size-8 items-center justify-center border border-line bg-surface/90 text-subtle backdrop-blur transition-colors hover:text-bad"
            >
              <Trash2 size={14} strokeWidth={1.6} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
