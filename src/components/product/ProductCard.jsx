"use client";

import { useId } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { useDispatch, useSelector } from "react-redux";
import {
  addGuestWishlistItem,
  removeGuestWishlistItem,
} from "@/redux/features/wishlist/wishlistSlice";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useProductImpression } from "@/hooks/useProductImpression";
import { rememberProduct } from "@/lib/plpScroll";
import {
  gtmItem,
  pushAddToWishlist,
  pushProductClick,
  pushRemoveFromWishlist,
} from "@/lib/gtm";
import { formatPrice } from "@/utils/formatPrice";

import "swiper/css";
import "swiper/css/pagination";

/**
 * Product card, following the anatomy of the jewelry build's: square image, wishlist top-right,
 * then price / struck compare price / discount pill, title, spec line.
 *
 * The jewelry build's is 919 lines because it also carries gold-colour swatches, 9KT variant
 * selection, Ornaverse component parsing, per-variant price fetches, review stars, a video dialog
 * and a "view similar" drawer. None of that has data here and half of it is jewelry-only.
 */
/**
 * CONTROLS overlaid on the product photo -- wishlist, image arrows.
 *
 * Frosted glass, as Wakefit does it: a translucent white plate over a backdrop blur, so the
 * material still reads through the control instead of being punched out by it. The blur is what
 * makes this work on a pale photograph -- a flat 60% white would just look washed out, but blurring
 * what is behind it creates an edge without a fill.
 *
 * LABELS (the tag, the stock note) stay solid charcoal: a label should be read, not seen through.
 * Controls on the PAGE rather than on a photo (the rail arrows) stay solid white.
 */
const CONTROL = "z-10 rounded-sm bg-surface/60 text-ink backdrop-blur-md";

/** LABELS overlaid on the product photo. */
const LABEL =
  "z-10 rounded-sm bg-ink px-2 py-1 text-[11px] leading-none text-white sm:px-2.5 sm:py-1.5 sm:text-xs";

/**
 * `list` and `index` are analytics only and both optional -- a card renders identically without
 * them. `list` names WHICH listing this card is in ("collection:subway-tiles", "rail:related") so
 * a grid and the rail beneath it do not merge into one number, and `index` is its position in that
 * list, which is what a click-through-by-position report is built from.
 */
export default function ProductCard({ product, priority = false, list = "", index = 0 }) {
  const id = useId().replace(/:/g, "");
  const prevClass = `img-prev-${id}`;
  const nextClass = `img-next-${id}`;
  const dispatch = useDispatch();
  // BOTH ARRAYS. `guestItems` is the localStorage list; `items` is the signed-in customer's server
  // list, and mergeGuestWishlist EMPTIES guestItems once it has pushed them up. Reading only
  // guestItems meant a signed-in customer's saved tiles lost their filled heart and their scrim on
  // the next page load -- the card claimed the product was unsaved while the wishlist page listed it.
  const guestItems = useSelector((state) => state.wishlist.guestItems);
  const items = useSelector((state) => state.wishlist.items);
  // The wishlist is persisted in localStorage, so it does not exist server-side. Reading it during
  // the first render made the markup disagree with the server and React rebuilt the entire tree,
  // which left this card's gallery -- and the hero -- as blank Swipers.
  const hasMounted = useHasMounted();
  const isWishlisted =
    hasMounted &&
    [...guestItems, ...items].some((i) => i.productHandle === product.handle);

  const images = product.images ?? [];
  // The card does not carry a made-to-order note at all -- the PDP is where lead time belongs.
  const tag = product.tags?.find((t) => t !== "Made to order");
  const discount =
    product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  // Guest-only for now: there is no auth flow yet, so every visitor is a guest and this persists
  // locally until the wishlist page exists to read it.
  const toggleWishlist = () => {
    if (isWishlisted) {
      dispatch(removeGuestWishlistItem({ productHandle: product.handle }));
      pushRemoveFromWishlist(gtmItem(product, index));
    } else {
      dispatch(
        addGuestWishlistItem({
          productId: product.handle,
          productHandle: product.handle,
          title: product.title,
          image: images[0],
          price: product.price,
          comparePrice: product.comparePrice ?? "",
          // The card's price is per sq ft when a unit exists; the PDP saves the pack price. The
          // wishlist row prints the unit so ₹82/sq ft and ₹1,845/box cannot read as the same kind
          // of number.
          unit: product.unit ?? null,
        }),
      );
      pushAddToWishlist(gtmItem(product, index));
    }
  };

  // Seen, not merely loaded -- the ref goes on the card's root and fires once half of it is in the
  // viewport. See useProductImpression.
  const impressionRef = useProductImpression(product, list);

  /**
   * One handler for the card's whole surface, because every route into the product bubbles through
   * it -- each gallery slide and the title are separate links.
   *
   * Gated on `closest("a")` so the wishlist heart and the gallery arrows, which are buttons and
   * navigate nowhere, do not report a product click. `rememberProduct` below deliberately is NOT
   * gated: it is a scroll-restore note that the next real click overwrites.
   */
  const onCardClick = (event) => {
    rememberProduct(product.handle);
    if (!event.target.closest?.("a")) return;
    pushProductClick({ ...gtmItem(product, index), item_list_name: list });
  };

  const fill = (src, i) => (
    <Image
      src={src}
      alt={i === 0 ? (product.alt ?? "") : ""}
      fill
      sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
      priority={priority && i === 0}
      className="object-cover"
    />
  );

  return (
    // The card has three separate links into the product -- each gallery slide, and the title -- so
    // the "which card did they open" note is taken here, where every one of them bubbles through.
    // The wishlist button bubbles too and does not navigate; it only rewrites a note that the next
    // real click overwrites, so it is not worth stopping.
    // `data-plp-handle` is what the listing page scrolls back to on return -- see lib/plpScroll.
    <div ref={impressionRef} data-plp-handle={product.handle} onClick={onCardClick}>
      <div className="group/card media-bed relative aspect-swatch overflow-hidden rounded-sm border border-line">
        {/* More than one image: a swipeable gallery, their arrangement -- a hairline progress bar
            along the bottom edge on touch, arrows that fade in on hover from 1024px up. One image:
            no slider at all, so a single-photo card carries no Swiper instance. `nested` tells the
            inner Swiper to hand the gesture back to the product rail at either end. */}
        {images.length > 1 ? (
          <>
            <Swiper
              modules={[Navigation, Pagination]}
              nested
              // ponytail: `loop` and nothing else. The arrows never dead-end on a card, which is
              // what made the last image feel like a broken control rather than the end of a set.
              // EXCEPT inside a rail: `nested` hands the gesture to the parent Swiper only at an
              // edge, and a looping gallery has no edge -- so a multi-image card swallowed every
              // horizontal swipe and the rail felt stuck. Rails get edges back; grids keep the loop.
              loop={!list.startsWith("rail:")}
              slidesPerView={1}
              navigation={{ prevEl: `.${prevClass}`, nextEl: `.${nextClass}` }}
              pagination={{ type: "progressbar" }}
              className="h-full w-full [&_.swiper-pagination-progressbar]:top-auto! [&_.swiper-pagination-progressbar]:bottom-0! [&_.swiper-pagination-progressbar]:h-0.5! [&_.swiper-pagination-progressbar]:bg-line! lg:[&_.swiper-pagination]:hidden!"
            >
              {images.map((src, i) => (
                <SwiperSlide key={src}>
                  <Link
                    href={`/products/${product.handle}`}
                    prefetch={false}
                    aria-label={product.title}
                    className="relative block h-full w-full"
                  >
                    {fill(src, i)}
                  </Link>
                </SwiperSlide>
              ))}
            </Swiper>

            <button
              type="button"
              aria-label="Previous image"
              className={`${prevClass} ${CONTROL} absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100 lg:flex`}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              className={`${nextClass} ${CONTROL} absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100 lg:flex`}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <Link
            href={`/products/${product.handle}`}
            prefetch={false}
            aria-label={product.title}
            className="relative block h-full w-full"
          >
            {images[0] && fill(images[0], 0)}
          </Link>
        )}

        {/* Merchandising tag, Material Depot's placement and weight: a SOLID chip in the top-left
            corner, not an outline -- it is a label, not a control, and the fill is what makes it
            read at a glance over a busy tile photograph. Theirs is brand brown with white type
            ("Month's Favourite", "Trending in carts"); ours is charcoal, orange being reserved for
            actions. Same charcoal as the controls -- position and shape tell them apart. */}
        {tag && (
          <span className={`${LABEL} pointer-events-none absolute left-2 top-2 font-medium`}>
            {tag}
          </span>
        )}

        {/* SAVED STATE on the photo, CaratLane's PLP treatment: once a product is in the list the
            image dims under a scrim and says so, permanently -- not a flash that fades. In a
            twelve-card grid the heart alone is a 16px difference between "saved" and "not", which
            is invisible while scanning; the dimmed tile is legible at arm's length and is what
            stops the same product being saved twice.

            THE HEART STAYS ON TOP, unlike theirs. CaratLane's scrim covers the heart, so the only
            way to unsave is the wishlist page -- a one-way door on a control that reads as a
            toggle. `pointer-events-none` here plus the button's z-10 keeps the second tap working.

            Not a hover reveal (user, 2026-08-22): saved-ness is state, and state that only appears
            under the cursor does not exist on a phone. */}
        {isWishlisted && (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-ink/45">
            <span className="text-xs font-medium uppercase tracking-wide text-white">
              In your wishlist
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={toggleWishlist}
          aria-label={isWishlisted ? `Remove ${product.title} from wishlist` : `Save ${product.title}`}
          aria-pressed={isWishlisted}
          className={`${CONTROL} absolute right-2 top-2 flex h-8 w-8 items-center justify-center transition-colors hover:bg-surface`}
        >
          <Heart
            size={16}
            strokeWidth={1.5}
            className={isWishlisted ? "fill-current text-action" : ""}
          />
        </button>
      </div>

      {/* Category, then title, then a ruled price row -- Material Depot's arrangement, minus the
          product code: it means nothing to a customer browsing a grid. */}
      {/* CATEGORY on the left, RATING on the right, sharing ONE row.
          The rating rides this line rather than taking a line of its own between the title and the
          price, which is where it started. In a grid only some products have reviews, so an extra
          row appeared on some cards and not others and left the price lines of a four-across shelf
          staggered by 23px -- untidy in a way that reads as a bug, and today it would be one card
          in twelve. This row already exists on every card and was half empty, so the rating costs
          no height at all and the prices stay on one line across the whole grid.

          Rendered only when the product HAS a rating -- `rating` is null for every product with no
          published review (see attachRatings). No empty star row and no "(0)": a greyed-out row of
          five stars is the manufactured social proof this grid refuses everywhere else, and on a
          card it would appear on every tile at once, which is how a whole shelf comes to look
          reviewed when none of it is.

          ONE STAR AND THE NUMBER, not a row of five (user, 2026-08-22). A five-star row is ~60px
          wide, which on a 160px card is a third of this line spent drawing what "4.5" says in
          twelve pixels -- and at 11px the half-star clip is too small to read anyway, so the
          picture was less precise than the figure it replaced. One gold star marks WHAT the number
          is; the number carries the score. The full row still runs on the PDP, where there is room
          for it and where the breakdown sits beside it.

          The COUNT stays, in meta grey. It is the one thing neither the star nor the average can
          say, and 4.5-from-two-reviews and 4.5-from-two-hundred are not the same claim. */}
      {(product.category || product.rating?.count > 0) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] uppercase tracking-wide text-subtle">
            {product.category}
          </span>
          {product.rating?.count > 0 && (
            <span className="flex shrink-0 items-center gap-1">
              {/* Number first, then the star -- the same order as the PDP's rating pill, which
                  follows the Indian convention (Flipkart, Zomato, CaratLane). The digit is the
                  information; the star only says what kind of number it is. */}
              <span className="num text-[11px] font-medium text-ink">
                {product.rating.average.toFixed(1)}
              </span>
              <Star
                size={12}
                strokeWidth={1.5}
                aria-hidden="true"
                className="fill-gold text-gold-line"
              />
              <span className="num text-[10px] text-meta">({product.rating.count})</span>
            </span>
          )}
        </div>
      )}

      <Link href={`/products/${product.handle}`} prefetch={false}>
        <h3 className="mt-1 line-clamp-1 text-sm leading-snug text-ink underline-offset-4 hover:underline">
          {product.title}
        </h3>
      </Link>

      {/* Two columns at every width, Material Depot's way. Measured on their 174px mobile card:
          they do not stack, they shrink -- unit price 14px, box price 10px, discount 9px. The
          secondary figures recede instead of competing, which is what keeps it clean in ~160px.
          Stacking them at one size made the block tall and gave all three equal weight. */}
      <div className="mt-2.5 flex items-start justify-between gap-2 border-t border-line pt-2.5 lg:gap-3">
        {/* The price a customer compares on: per sq ft for tiles, per sheet or roll otherwise. */}
        {/* Per sq ft whatever the material -- that is what makes two cards comparable. The unit is
            omitted rather than assumed when a product has no coverage set, so the card never
            labels a pack price as a square-foot price. */}
        {/* "from" when the product has more than one variant: the figure is the cheapest of them,
            and without the word it reads as THE price for a product that has several. Same weight
            as the unit suffix, so the number still leads. */}
        <p className="num text-sm font-semibold text-ink lg:text-lg">
          {product.fromPrice && (
            <span className="text-[11px] font-normal text-subtle lg:text-xs">from </span>
          )}
          ₹{formatPrice(product.price)}
          {product.unit && (
            <span className="text-[11px] font-normal text-subtle lg:text-xs">/{product.unit}</span>
          )}
        </p>

        {/* What they actually pay: pack price, then the saving against MRP -- Material Depot's right
            column, ₹862/Box over 44% OFF ₹1522. BOTH figures are per pack. The struck price used to
            be `comparePrice`, which products.js has already divided by coverage, so a struck ₹155/sq
            ft sat under ₹1,380/box and read as a price RISE across two units (user, 2026-08-21).
            `packCompare` is Shopify's compare-at undivided, which is the number this column wants. */}
        {(product.packPrice > 0 || discount > 0) && (
          <div className="shrink-0 text-right">
            {product.packPrice > 0 && (
              <p className="num text-[10px] text-subtle lg:text-xs">
                ₹{formatPrice(product.packPrice)}/{product.packUnit ?? "box"}
              </p>
            )}
            {discount > 0 && (
              <p className="num text-[9px] leading-tight lg:text-[11px]">
                <span className="font-semibold text-good">{discount}% OFF</span>{" "}
                <span className="text-meta line-through">
                  ₹{formatPrice(product.packCompare > 0 ? product.packCompare : product.comparePrice)}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
