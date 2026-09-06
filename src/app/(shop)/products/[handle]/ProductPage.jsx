"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { ArrowRight, Lock, ShoppingCart, Star, Wallet } from "lucide-react";

import ProductGallery from "@/components/product/ProductGallery";
import { useStickyFit } from "@/hooks/useStickyFit";
import { jumpTo } from "@/utils/jumpTo";
import BuySheet from "@/components/product/BuySheet";
import PincodeCheck from "@/components/product/PincodeCheck";
import ProductHelp from "@/components/product/ProductHelp";
import ProductInsights from "@/components/product/ProductInsights";
import ProductDetails from "@/components/product/ProductDetails";
import SpecChips from "@/components/product/SpecChips";
import VariantOptions from "@/components/product/VariantOptions";
import WhatsappIcon from "@/components/common/WhatsappIcon";
import { syncCart } from "@/redux/features/cart/cartSlice";
import {
  addGuestWishlistItem,
  removeGuestWishlistItem,
} from "@/redux/features/wishlist/wishlistSlice";
import { useHasMounted } from "@/hooks/useHasMounted";
import {
  gtmProductItem,
  pushAddToWishlist,
  pushProductView,
  pushRemoveFromWishlist,
} from "@/lib/gtm";
import { areaForBoxes, boxesForArea } from "@/lib/product";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { WHATSAPP_NUMBER } from "@/data/footer";
import { formatPrice } from "@/utils/formatPrice";

/**
 * The PDP's interactive half: gallery, buy box, and the details that change with the variant.
 *
 * WHAT THIS PAGE IS, and is not. It follows Material Depot's anatomy -- breadcrumb, thumbnails
 * beside a big image, per-sq-ft price against a pack price, spec chips, an area calculator, a
 * sample offer, then specs -- because that anatomy is built for someone buying a floor by the
 * square foot. It does NOT carry:
 *
 *   - their VARIANT DRAWER. Theirs opens a panel of photographed colourways because a tile's
 *     colour cannot be read from its name. Our options are sizes, which can, so they are a row of
 *     buttons that show the thing that actually differs between them: the price per sq ft and how
 *     much a box covers.
 *   - their STORE and SCHEME blocks -- nearest experience centre, book a visit, 3D visualizer,
 *     grouting and lighting previews. There are no stores and no visualizer.
 *   - their manufactured social proof ("55+ carts have this", "40+ projects used this"). There is
 *     no number behind those here, and an invented one is a lie printed next to a real price.
 *
 * And from the jewelry build's 3,824-line ProductPageClient it carries the SHAPE of the buy box and
 * nothing else: engraving, price breakup, "wear this with", our process, lab-grown vs mined
 * diamonds, ring sizers, metal/karat pickers, store stock and the coin balance are all jewelry, and
 * gone.
 */
export default function ProductPage({ product, reviews }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const hasMounted = useHasMounted();

  const [variant, setVariant] = useState(
    () => product.variants.find((v) => v.inStock) ?? product.variants[0],
  );
  const [area, setArea] = useState("");
  const [boxes, setBoxes] = useState(1);
  // Off by default (user, 2026-08-13). It shipped on, which quietly added 10% to every order the
  // customer never asked for, and it made the tickbox behave asymmetrically once the box count was
  // typed by hand: the area written back from a box count carries no wastage, so UNTICKING an
  // already-ticked box re-derived the same count and looked broken. Starting off means the first
  // click always does something -- tick adds the 10%, untick takes it away again.
  const [wastage, setWastage] = useState(false);
  const [pincode, setPincode] = useState("");
  // The buy sheet. ONE state for both placements -- side panel on desktop, bottom sheet on a phone
  // -- because it is one panel, and BuySheet picks the side.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [status, setStatus] = useState(null); // "adding" | "added" | an error string
  // Separate from `status` on purpose: the cart's status renders in red when it is not one of the
  // two known-good values, and "Link copied" is not an error.
  const [note, setNote] = useState(null);

  /**
   * productView, once per product AND once per variant switched to.
   *
   * Per variant rather than per page, because on this store the variant IS the price -- a 600x600
   * and a 800x1200 of the same tile are different SKUs at different rates per sq ft, and reporting
   * only the one that happened to be in stock first says nothing about what the customer priced.
   * Keyed on the variant id so React's own re-renders (area typed, wastage ticked, sheet opened)
   * cost nothing.
   */
  useEffect(() => {
    if (!variant) return;
    pushProductView(gtmProductItem(product, variant));
  }, [product, variant]);

  const guestItems = useSelector((state) => state.wishlist.guestItems);
  // The wishlist is localStorage-backed, so reading it during the first render would make the
  // markup disagree with the server -- see the same guard in ProductCard.
  const wishlisted = hasMounted && guestItems.some((i) => i.productHandle === product.handle);

  /**
   * The desktop buy bar: whether it shows.
   *
   * Only once the buy box's own button has scrolled away, because a shopper reading the spec table
   * or the rails is furthest from the CTA at the moment they decide. `bottom < 0` means the button
   * left UPWARDS; a button merely below the fold keeps the bar away, so it cannot appear before the
   * page has even been read. On a phone that button is display:none and its rect reads all zeros, so
   * this stays false -- fine, because below lg the bar ignores it and is simply always pinned to the
   * bottom.
   *
   * IT NO LONGER MEASURES THE HEADER (user, 2026-08-15). This used to read [data-sticky-header]'s
   * live bottom edge into a `--bar-top` custom property so the bar could dock flush UNDER the nav.
   * It now covers the nav instead -- the jewelry build's AtcBar is `fixed top-0` at a z-index above
   * the header, and it is the right call: by the time this bar appears the header has already
   * collapsed to the ~48px Navbar strip, so docking under it spent 48px of the viewport on a menu
   * nobody is reading in order to show the price twice as far from the top. Covering it means
   * `lg:top-0`, a constant, and the measurement, the second rect read per frame and the whole
   * `{show, top}` object go with it.
   *
   * A scroll listener, NOT an IntersectionObserver: an observer only speaks when the edge is
   * crossed, and if its initial report is taken in a viewport that is still settling (fonts,
   * images, a devtools resize) it can record "already outside" and then stay silent for every
   * scroll that follows. One rect read per frame is the boring version that cannot get stuck, and
   * React bails out when the boolean is unchanged, so a scroll costs no re-render.
   */
  /* The buy column pins beside the gallery -- see useStickyFit for why both columns get the same
     rule rather than one of them being declared the sticky one. */
  const [buyRef, buyTop] = useStickyFit();

  const ctaRef = useRef(null);
  const [barShown, setBarShown] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;

      // BELOW lg THERE IS NO INLINE ADD BUTTON -- the block ctaRef watches is `hidden lg:block`, so
      // on a phone this bar is the only Add control there is. Watching that ref here would read a
      // display:none rect of all zeros, `bottom < 0` would never be true, and the bar would never
      // arrive at all.
      //
      // So the phone asks a different question: has the shopper touched the page yet? The bar parks
      // for the untouched first fold, where its 69px strip sits exactly on top of the rating pill,
      // and comes back on the first scroll -- which is the same gesture that would have moved the
      // pill out from under it anyway. Nothing is lost: the CTA is one flick away and returns for
      // the whole rest of the page.
      if (window.innerWidth < 1024) {
        setBarShown(window.scrollY > 40);
        return;
      }

      const el = ctaRef.current;
      if (!el) return;
      setBarShown(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Crossing lg swaps which question above is being asked, and a resize fires no scroll event.
    window.addEventListener("resize", onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!variant) return null;

  const discount =
    variant.comparePrice > variant.price
      ? Math.round(((variant.comparePrice - variant.price) / variant.comparePrice) * 100)
      : 0;
  const perSqFt = variant.perSqFt > 0;
  const total = boxes * variant.price;

  // Has the customer actually chosen a quantity, or is this still the untouched default? The buy
  // bar reads this to decide between showing a unit price and showing a total -- see the note there.
  const configured = Number(area) > 0 || boxes > 1;

  // A product can genuinely have no photography yet (ProductGallery renders nothing at all then), and
  // the two-column split has to collapse rather than leave the gallery's half of the page empty.
  const hasMedia = product.media.length > 0;

  /**
   * Honest urgency only. `stock` is Shopify's quantityAvailable, which is null unless inventory
   * is tracked -- and when it is null nothing renders, because an invented "only N left" is the
   * cheap-discount-UI this page refuses. Two true sentences:
   *   - the customer wants more boxes than the shelf holds (worth knowing BEFORE checkout);
   *   - the shelf is nearly empty (worth knowing before someone else's floor empties it).
   * ponytail: 20 boxes as "nearly empty" is a guess; tune when real stock levels exist.
   */
  const LOW_STOCK = 20;
  const packPlural = `${variant.packUnit}${variant.packUnit === "box" ? "es" : "s"}`;
  const stockNote =
    variant.inStock && variant.stock > 0
      ? boxes > variant.stock
        ? `${variant.stock} ${packPlural} in stock — the rest is made to order`
        : variant.stock <= LOW_STOCK
          ? `Only ${variant.stock} ${packPlural} left in stock`
          : null
      : null;

  /* ------------------------------------------------------------------ actions */

  // Changing size changes the coverage, so the box count is re-derived from the area the customer
  // typed rather than carried across -- 200 sq ft is 15 boxes of one size and 16 of the other.
  const chooseVariant = (next) => {
    setVariant(next);
    setStatus(null);
    const parsed = Number(area);
    if (parsed > 0 && next.coverage > 0) {
      setBoxes(Math.ceil((parsed * (wastage ? 1.1 : 1)) / next.coverage));
    }
  };

  // Editing the quantity clears a stale message -- an error from the last attempt is about the last
  // quantity, and leaving it under a number that has since changed reads as a complaint about the
  // new one. "adding" is left alone: that one is still true while the request is in flight.
  const touch = (set) => (value) => {
    set(value);
    setStatus((s) => (s === "adding" ? s : null));
  };

  /**
   * ONE ending. Every add now comes from the buy sheet, and every successful add goes to the cart:
   * someone who has just worked through area, size and coverage is finished deciding, and dropping
   * them back onto the PDP behind a closing sheet is the moment the order gets abandoned.
   *
   * Pincode is deliberately NOT sent as a line attribute: Shopify collects the real delivery
   * address at checkout, and a pincode typed here to check serviceability is not that address. Two
   * of them on one order is how the wrong one gets shipped to.
   */
  const areaDroveBoxes =
    Number(area) > 0 &&
    boxesForArea(Number(area), variant.coverage, wastage ? 0.1 : 0) === boxes;

  const addToCart = async () => {
    setStatus("adding");
    try {
      await dispatch(
        syncCart({
          add: {
            variantId: variant.id,
            quantity: boxes,
            // Why it is this many boxes, carried onto the order itself.
            //
            // `Area` and `Wastage` are only true when the box count was DERIVED from them. Since
            // editing the box count started writing the covered area back into that field, the
            // field is populated either way, and printing "Area: 322.5 · Wastage: 10%" on an order
            // whose 25 boxes were typed by hand tells the warehouse a story that did not happen --
            // 10% was never added. Re-deriving is the check: if the typed area and the tickbox
            // produce exactly the boxes being ordered, they are what drove it and are worth
            // recording. If they do not, only what the boxes cover is a fact.
            attributes: {
              ...(areaDroveBoxes && { Area: `${Number(area)} sq ft` }),
              ...(areaDroveBoxes && { Wastage: wastage ? "10%" : "none" }),
              ...(variant.coverage > 0 && {
                Covers: `${areaForBoxes(boxes, variant.coverage)} sq ft`,
              }),
            },
          },
        }),
      ).unwrap();
      setStatus("added");
      setSheetOpen(false);
      router.push("/checkout/cart");
    } catch (err) {
      // The sheet stays OPEN on failure, with the error under its own button: closing it would hide
      // both the message and the configuration the customer would have to type again.
      setStatus(typeof err === "string" ? err : "Could not add to cart. Try again.");
    }
  };

  const toggleWishlist = () => {
    if (wishlisted) {
      dispatch(removeGuestWishlistItem({ productHandle: product.handle }));
      pushRemoveFromWishlist(gtmProductItem(product, variant));
    } else {
      dispatch(
        addGuestWishlistItem({
          productId: product.handle,
          productHandle: product.handle,
          title: product.title,
          image: product.media[0]?.url,
          price: variant.price,
          comparePrice: variant.comparePrice ?? "",
          // Pack price, so the row says which pack. The card path saves per-sq-ft with its unit.
          unit: variant.packUnit || "box",
        }),
      );
      pushAddToWishlist(gtmProductItem(product, variant));
    }
  };

  // navigator.share on a phone, clipboard everywhere else. No share sheet of our own and no
  // per-network buttons -- the jewelry build ships a dialog with six of them.
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied");
      }
    } catch {
      /* the customer dismissed the share sheet; nothing to report */
    }
  };

  // NEXT_PUBLIC_SITE_URL, not window.location.href: this link is rendered on the server too, and
  // a value that only exists in the browser makes the two disagree -- React then throws the whole
  // tree away and rebuilds it, which is what leaves Swipers blank (see the note in ProductCard).
  const sampleLink =
    WHATSAPP_NUMBER &&
    buildWhatsappLink(WHATSAPP_NUMBER, [
      `Hi Material, I'd like a sample of ${product.title}`,
      `Size: ${variant.title}`,
      variant.sku && `Code: ${variant.sku}`,
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/products/${product.handle}`,
    ]);

  // The buy bar's WhatsApp button: a QUESTION, not a sample request. Someone hesitating at the
  // pinned bar has usually not decided what they want yet, so the message opens with the product
  // and lets them ask -- the sample row above is the one that asks for a sample.
  const askLink =
    WHATSAPP_NUMBER &&
    buildWhatsappLink(WHATSAPP_NUMBER, [
      `Hi Material, I have a question about ${product.title}`,
      `Size: ${variant.title}`,
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/products/${product.handle}`,
    ]);

  /* ---------------------------------------------------------------- rendering */

  return (
    // No bottom padding. This USED to carry pb-24 to clear the pinned mobile buy bar, from when the
    // buy box and specs were the last thing on the page. They are not any more -- five sections follow
    // -- so that padding was 96px of blank paper in the MIDDLE of the page, and it is what kept the
    // detail panels from meeting the promises strip on a phone. The clearance now lives at the end of
    // page.js, where the end of the page actually is.
    <div>
      {/* grid-cols-1 is NOT cosmetic: with no explicit track below lg, the implicit `auto` column
          sizes itself to the gallery Swiper's max-content -- a circular measurement that resolves
          to a ~16-million-pixel track and a blank gallery. Tailwind's cols-1 is minmax(0, 1fr),
          which is the constraint that breaks the cycle. */}
      {/* The twelve-column split only applies when there IS a gallery. A product with no photography
          used to keep the 7-column slot anyway, so 58% of the widest part of the page was blank paper
          with the buy box marooned on the right -- see the fx-no-images fixture. With no media the grid
          collapses to one column and the buy box takes its natural width on the left, which is what a
          product page without pictures should look like. */}
      {/* items-start, not the default stretch: a stretched track takes the TALLER column's height,
          so the buy box had no height of its own and `sticky` had nothing to pin. Each column now
          measures itself, which is also what useStickyFit reads.

          The top margin came down from mt-4/lg:mt-6 (user, 2026-09-05): with the breadcrumb's own
          lg:py-3 under it that was 36px of air between an 11px crumb and the photographs. */}
      <div
        className={`container-main mt-2 grid grid-cols-1 items-start gap-8 lg:mt-3 lg:gap-10 ${
          hasMedia ? "lg:grid-cols-12" : ""
        }`}
      >
        {/* ================================== GALLERY ================================== */}
        {hasMedia && (
          <div className="lg:col-span-7">
            {/* The mosaic pins itself against the header -- see ProductGallery. */}
            <ProductGallery
              images={product.media}
              title={product.title}
              tag={product.tags[0]}
              wishlisted={wishlisted}
              onWishlist={toggleWishlist}
              onShare={share}
            />
          </div>
        )}

        {/* ================================== BUY BOX ================================== */}
        {/* Pinned beside the gallery -- or scrolling past it, if the buy box is the taller of the
            two. useStickyFit gives both columns the same rule, so the one that fits the viewport is
            the one that rides down the page and nothing has to decide which that is. Desktop only:
            below lg the columns are stacked and there is nothing to pin against. */}
        <div
          ref={buyRef}
          style={{ top: `${buyTop}px` }}
          className={`lg:sticky ${hasMedia ? "lg:col-span-5" : "lg:max-w-xl"}`}
        >
          {product.category && (
            <p className="text-[11px] uppercase tracking-wide text-subtle">{product.category}</p>
          )}

          <h1 className="mt-1.5 font-display text-xl leading-snug tracking-[-0.02em] text-ink lg:text-2xl">
            {product.title}
          </h1>

          {/* THE RATING, IN THE FIRST FOLD -- and only when there is one. No empty five-star row,
              no "(0)": this page refuses invented social proof everywhere else, and a greyed-out
              row of stars beside a real price is the same lie drawn instead of written.

              It reads as a LINK, not a caption: the score jumps to the reviews. An anchor to
              #reviews rather than a button -- the section is already on the page, five screens
              down, and an anchor works with JavaScript off and can be opened in a new tab.

              "WRITE A REVIEW" IS NOT IN THIS FOLD (user, 2026-09-05). It sat beside the pill and
              pointed at the same #reviews anchor, so it bought no reach -- and it asks the one
              question a first-time visitor cannot answer, in the fold whose only job is to get them
              to a price. ProductReviews still carries it, next to the reviews it belongs with.

              The average is spelled out here (4.3, not just stars) because this is where the buying
              decision is made and the difference between 4.1 and 4.8 is the whole point. The card
              in the grid deliberately shows only stars and a count -- see the note in ProductCard. */}
          {reviews?.count > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* A PILL, CaratLane's shape (audited 2026-08-22) -- theirs reads "4.9★ | 1094
                  Ratings" in a bordered capsule above the price, and it is the right call over the
                  loose inline row this used to be. A bordered object is one thing the eye lands on;
                  a row of stars, a number and a count set loose beside a 24px title is three, and
                  it read as caption text rather than something to click.

                  NUMBER FIRST, then the star. That is the Indian convention -- Flipkart, Zomato,
                  Swiggy and CaratLane all put the figure ahead of the mark -- and it is also what
                  survives at a glance: the digit is the information, the star only says what kind
                  of number it is. ProductCard does the same, so the two never disagree. */}
              <a
                href="#reviews"
                onClick={jumpTo("reviews")}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 py-1 transition-colors hover:border-line-strong"
              >
                <span className="num text-sm font-semibold leading-none text-ink">
                  {reviews.average.toFixed(1)}
                </span>
                <Star
                  size={13}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="fill-gold text-gold-line"
                />
                <span className="h-3 w-px bg-line" aria-hidden="true" />
                <span className="num text-xs leading-none text-subtle">
                  {reviews.count} review{reviews.count === 1 ? "" : "s"}
                </span>
              </a>
            </div>
          )}

          {/* PRICE. Per sq ft leads and pack price sits opposite it -- Material Depot's split, and
              the right one: the left figure is what you compare tiles on, the right is what you
              pay. Both come off the SAME variant, so the row can never mix two. */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
            <p className="num text-2xl font-semibold text-ink lg:text-3xl">
              ₹{formatPrice(perSqFt ? variant.perSqFt : variant.price)}
              <span className="text-sm font-normal text-subtle">
                {perSqFt ? "/sq ft" : `/${variant.packUnit}`}
              </span>
            </p>

            {/* The pack price and the saving against MRP, BOTH per pack -- Material Depot's right
                column. The struck figure used to be `perSqFtCompare`, compare-at divided by coverage,
                which put a struck ₹155/sq ft directly under ₹1,380/box and read as "was ₹155, now
                ₹1,380" -- a price RISE across two different units (user, 2026-08-21). Shopify only
                ever holds compare-at per pack, so that is the number shown here, against the pack
                price it belongs to. The PERCENTAGE is unaffected: it is computed off the pack pair. */}
            <div className="text-right">
              {perSqFt && (
                <p className="num text-sm text-ink">
                  ₹{formatPrice(variant.price)}
                  <span className="text-subtle">/{variant.packUnit}</span>
                  {variant.pieces && (
                    <span className="text-subtle"> ({variant.pieces} piece)</span>
                  )}
                </p>
              )}
              {discount > 0 && (
                <p className="num text-xs">
                  <span className="text-meta line-through">
                    ₹{formatPrice(variant.comparePrice)}
                  </span>{" "}
                  <span className="font-semibold text-good">{discount}% OFF</span>
                </p>
              )}
            </div>

            {/* GST, stated. The Indian tile trade quotes ex-GST by convention, so a bare ₹85/sq ft is
                read by half the market as "plus 18%" -- and the buyer who read it that way finds out
                at checkout on a ₹30,000 order. `w-full` drops it onto its own line under the wrapping
                flex row, so it sits beneath both figures rather than beside either. */}
            <p className="w-full text-[11px] text-subtle">Inclusive of GST</p>
          </div>

          {/* SPEC CHIPS. Material Depot's row, built from the metafields that are actually set
              rather than a hand-written marketing list -- see mapProduct in lib/product.js. Tinted
              by kind; the palette and why it stops short of a rainbow are documented in SpecChips. */}
          <SpecChips specs={product.specs} />

          {/* OPTIONS. Shared with the buy sheet -- see VariantOptions. */}
          <div className="mt-6">
            <VariantOptions product={product} variant={variant} onChoose={chooseVariant} />
          </div>

          {stockNote && <p className="mt-5 text-xs font-medium text-warn">{stockNote}</p>}

          {/* DELIVERY, answered here rather than at checkout. A buyer who cannot find out whether
              their pincode is covered assumes it is not. */}
          <div className="mt-5 border-t border-line pt-5">
            <PincodeCheck
              pincode={pincode}
              onPincode={setPincode}
              inStock={variant.inStock}
            />
          </div>

          {/* ACTIONS. The ref is what the pinned bar watches -- see the effect above.
              This OPENS THE SHEET; it does not add. There is no calculator on the page any more, so
              there is no quantity here to add -- the sheet is where an area becomes a box count, and
              every add in the page goes through it. One configuration surface, reachable from every
              button, which is the whole point of doing it in a sheet. */}
          <div ref={ctaRef} className="mt-5 hidden lg:block">
            <AddButton inStock={variant.inStock} onClick={() => setSheetOpen(true)} />
            {/* Microcopy, because "Add to cart" that opens a panel instead of adding is a surprise
                exactly once, and this is cheaper than the surprise. */}
            {variant.inStock && (
              <p className="mt-2 text-center text-[11px] text-subtle">
                {variant.coverage > 0
                  ? "Tell us your area next — we work out the boxes"
                  : "Choose your quantity next"}
              </p>
            )}
          </div>

          {note && <p className="mt-3 text-xs text-subtle">{note}</p>}

          {/* SAMPLES. Material Depot sells a sample as a line item; there is no sample variant in
              this store, so this opens WhatsApp with the product already written into the message
              rather than pretending there is a sample to add to a cart.

              The icon is the WHATSAPP mark now, in WhatsApp's own green, on its own plate. It used
              to be Lucide's MessageCircle -- a generic charcoal speech bubble, which is the one
              thing this row cannot afford: the customer has to know the tap opens a chat with a
              person, and a bubble that could equally mean "reviews" or "notes" does not say that. */}
          {product.samplePrice && sampleLink && (
            <a
              href={sampleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-3 flex items-center gap-3.5 rounded-sm border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#25D366]/10 text-[#128C7E]">
                <WhatsappIcon className="size-[19px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-ink">Not sure about the shade?</span>
                <span className="num block text-xs text-subtle">
                  Order a sample for ₹{formatPrice(product.samplePrice)}, refunded against your order
                </span>
              </span>
              <ArrowRight
                size={16}
                strokeWidth={1.5}
                className="ml-auto shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
              />
            </a>
          )}

          {/* Only claims the site already makes. Freight is the announcement bar's promise; the
              checkout genuinely is Shopify's own hosted one (api/cart's checkoutUrl), which answers
              the "is paying here safe?" hesitation without a wall of badges. The delivery-area line
              that used to sit here is gone -- PincodeCheck above now answers it for the customer's
              own pincode, which is strictly more useful than the claim it replaced. */}
          <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-subtle">
            <li className="flex items-center gap-2">
              <Wallet size={14} strokeWidth={1.5} className="shrink-0" />
              Freight quoted before you pay — no surprises at checkout
            </li>
            <li className="flex items-center gap-2">
              <Lock size={14} strokeWidth={1.5} className="shrink-0" />
              Secure checkout, hosted by Shopify
            </li>
          </ul>
        </div>
      </div>

      {/* ONE heading for the whole details area, then the prose panels under it. The cards explain
          what each figure MEANS to someone buying a floor once in a decade and the strip beneath them
          says which exact item it is; the panels are the reading. All variant-aware -- coverage,
          pieces and thickness change with size. */}
      <ProductInsights product={product} variant={variant} />

      {/* HELP SITS HERE, between the summary and the long form, rather than after everything.
          It is the right beat: the cards and the strip are as much as most people read, so the
          question "do I understand this well enough to buy it?" is asked at exactly this point --
          and the answer for anyone who does not is a phone number, offered before they either
          commit to reading five panels or leave. Below the panels it was only ever found by the
          people who had already read their way past needing it.

          The number to ring, on the product page rather than in the footer. Replaces HelpMeChoose
          here -- see the note in ProductHelp. */}
      <ProductHelp product={product} variant={variant} />

      <ProductDetails product={product} variant={variant} />

      {/* ================================== BUY BAR ==================================
          Two placements, one element, because it is one thought: "the thing you are deciding about,
          and the button".

            PHONE  -- pinned to the BOTTOM for the whole page, as the collection page's filter bar
                      is. That is where the thumb already is, and the safe-area padding keeps it
                      clear of the home indicator.
            DESKTOP -- pinned to the TOP and OVER the sticky header, and only once the buy box's own
                      button has scrolled away. A mouse has no thumb-reach problem, so the bar
                      belongs where the eye already is -- the top of the reading column, in the
                      same band as the nav -- rather than at the far bottom edge of a 900px window
                      where it reads as a cookie notice and competes with the footer.

          It TAKES THE NAV'S BAND rather than docking beneath it (user, 2026-08-15). By the time this
          bar appears the header has collapsed to the ~48px Navbar strip, and stacking two full-width
          bars pushed the price down the screen to make room for a menu nobody reads mid-purchase.
          Same trade the jewelry build's AtcBar makes: `fixed top-0`, z-index above the header, nav
          covered.
          `bottom-auto` is what stops the element being stretched between both edges once a top is
          set. The nav comes back the moment the bar slides away, which is as soon as the buy box's
          own button is back on screen.

          WHAT THE BAR CARRIES, per screen (user, 2026-08-15):

            PHONE   -- the WhatsApp icon and a FULL-WIDTH "Add to cart", and nothing else. A phone
                       bar cannot hold a price AND a real button: splitting it gave the price half
                       the width and left the primary action as a 128px "Add". The price is already
                       in the buy box and on the sheet's confirm row, so nothing is lost.
            DESKTOP -- title, price, WhatsApp, button. The row is 1440px wide; it has the room.

          WHAT THE FIGURE MEANS, on the screen that still shows it. There is no calculator on the
          page any more, so until the customer opens the sheet there IS no chosen quantity -- and
          printing "₹1,845 · 1 box" for a default nobody picked is the same lie the blind Add button
          used to tell, just written out instead of clicked. So the bar shows the UNIT price, the
          figure tiles are compared on, and only switches to a total once a real choice exists
          (`configured`). Close the sheet with 15 boxes set and the bar keeps saying ₹27,668,
          because by then it is true.

          THE BUTTON NO LONGER ADDS. It opens the buy sheet -- the whole reason that sheet exists is
          that this bar cannot show an area, a size and a coverage, so a bare "Add" here was adding
          ONE box to an order that needed fifteen. See BuySheet.

          WhatsApp sits beside it, their pairing: their PDP runs the cart CTA and a WhatsApp CTA as
          a pair because in this market half the questions that block a sale are asked in chat.
          Icon-only and square in both placements so the primary action keeps the width -- ONE icon,
          not a second labelled button, because two full CTAs side by side is two primaries. */}
      {/* z-40 on a phone (over the page, under nothing) but z-110 from lg up, because the sticky
          header is z-100 and the point of the desktop bar is now to cover it.

          It SLIDES rather than appearing, which it has to now that it lands on top of the nav: an
          instant swap between two different full-width white bars in the same 48px of screen reads
          as a flicker, not a change. `hidden` cannot be part of that -- display:none has nothing to
          transition -- so the parked state is a translate off the nearest edge (DOWN on a phone,
          UP on desktop) with pointer-events off.

          IT PARKS ON A PHONE TOO (user, 2026-08-24). It used to be pinned to the bottom for the
          whole page, and that 69px strip sits exactly where the rating pill lands at scroll 0 on a
          taller phone -- so the first tap on "4.5 | 2 reviews" hit the buy bar instead, and the
          shopper had to scroll and tap again. pointer-events-none alone would not fix it: an
          invisible bar still covering the pill is worse, because nothing on screen explains the
          dead tap. Parking it off-edge until the inline Add button scrolls away gives the first
          fold back to the content, and `barShown` is the same signal desktop already uses -- so
          both sizes now answer "is the real Add button still on screen?" the same way. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-surface px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-transform duration-300 lg:top-0 lg:bottom-auto lg:z-110 lg:gap-8 lg:border-b lg:border-t-0 lg:px-10 lg:pb-3 ${
          barShown ? "" : "pointer-events-none translate-y-full lg:-translate-y-full"
        }`}
      >
        {/* THE SWATCH LEADS (user, 2026-09-05). This bar appears once the buy box has scrolled away,
            so by then the photograph is gone too and the row was four lines of text with no sign of
            what it is about. On a page selling how a material LOOKS, the thumbnail is the fastest
            reminder of which tile is being priced -- and it makes the bar read as the product
            rather than as a toolbar.

            alt="" on purpose: the title is the next element in the row, and a screen reader that
            announces the same product name twice in one bar is worse than one that skips a
            decorative 44px square. Desktop only, like the price -- the phone bar is WhatsApp and a
            full-width Add, and anything else in that row squeezes the primary action. */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          {product.media?.[0]?.url && (
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-line bg-paper">
              <Image
                src={product.media[0].url}
                alt=""
                fill
                sizes="44px"
                unoptimized={product.media[0].url.includes("cdn.shopify.com")}
                className="object-cover"
              />
            </span>
          )}

          {/* truncate, NOT a second line: this bar is pinned over the nav at a fixed height, and a
              title that wrapped would either push the row taller or spill behind the button. The
              full name is on the page behind it and in the sheet the button opens. */}
          <p className="min-w-0 truncate text-sm text-ink">
            {product.title}
            {variant.title !== "Default Title" && (
              <span className="num text-subtle"> · {variant.title}</span>
            )}
          </p>
        </div>
        {/* DESKTOP ONLY (user, 2026-08-15). On a phone this figure was taking half the bar and
            squeezing the primary action down to a 128px "Add" -- the page's most important control,
            at its smallest, on the screen size where thumbs are the input. The price is not lost:
            it is in the buy box above and on the sheet's confirm row, which is the screen where it
            actually has to be right. Desktop keeps it -- there the bar docks under the nav with a
            title beside it and there is room for the sentence. */}
        <div className="hidden min-w-0 lg:block lg:flex-none lg:text-right">
          {configured ? (
            <>
              <p className="num truncate text-base font-semibold text-ink">
                ₹{formatPrice(total)}
              </p>
              <p className="num truncate text-[11px] text-subtle">
                {boxes} {variant.packUnit}
                {boxes === 1 ? "" : variant.packUnit === "box" ? "es" : "s"}
                {variant.coverage > 0 && ` · ${areaForBoxes(boxes, variant.coverage)} sq ft`}
              </p>
            </>
          ) : (
            <>
              <p className="num truncate text-base font-semibold text-ink">
                ₹{formatPrice(perSqFt ? variant.perSqFt : variant.price)}
                <span className="text-xs font-normal text-subtle">
                  {perSqFt ? "/sq ft" : `/${variant.packUnit}`}
                </span>
              </p>
              {perSqFt && (
                <p className="num truncate text-[11px] text-subtle">
                  ₹{formatPrice(variant.price)}/{variant.packUnit}
                  {variant.coverage > 0 && ` · ${variant.coverage} sq ft`}
                </p>
              )}
            </>
          )}
        </div>

        {/* ASK AND BUY ARE ONE GROUP, at gap-3 rather than the row's gap-8 (user, 2026-09-05).
            Every child sat at the same 32px, so the WhatsApp square floated midway between the price
            and the button and read as a third, unrelated item. Two controls that answer the same
            question -- "I want this" / "I have a question about this" -- belong at arm's length from
            each other and a full gap away from the figures they act on.

            The group keeps the phone layout intact: flex-1 here with flex-1 on the button inside is
            the same full-width Add it always was, with the icon beside it. */}
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
        {askLink && (
          <a
            href={askLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ask about this product on WhatsApp"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-[#128C7E] transition-colors hover:border-line-strong"
          >
            <WhatsappIcon className="size-5" />
          </a>
        )}

        {/* Same control as the buy box, narrower. No "added" state to handle: a successful add
            leaves this page for the cart, so the only thing this button is ever doing is opening
            the sheet. */}
        {/* Takes the whole bar on a phone, beside the one WhatsApp icon; a fixed 208px on desktop,
            where the price and title share the row with it. The old `compact` variant that shortened
            the label to "Add" is gone -- neither width needs it now, and "Add" on the one control
            that opens a configuration panel was the least informative label on the page. */}
        <div className="min-w-0 flex-1 lg:w-52 lg:flex-none">
          <AddButton inStock={variant.inStock} onClick={() => setSheetOpen(true)} />
        </div>
        </div>
      </div>

      <BuySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        product={product}
        variant={variant}
        area={area}
        boxes={boxes}
        wastage={wastage}
        status={status}
        onArea={touch(setArea)}
        onBoxes={touch(setBoxes)}
        onWastage={setWastage}
        onVariant={chooseVariant}
        onConfirm={addToCart}
        stockNote={stockNote}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- pieces */

/**
 * The add control, in both placements. It OPENS THE BUY SHEET -- nothing on this page adds to the
 * cart directly any more, so this carries no busy or added state: the sheet owns the request and its
 * own button shows the spinner and any error.
 */
function AddButton({ inStock, onClick }) {
  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-sm border border-line-strong bg-surface py-3.5 text-xs uppercase tracking-wide text-subtle"
      >
        Made to order
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      // font-semibold: at 12px uppercase with tracking, regular weight reads thin against a solid
      // orange fill -- the page's most important control was its lightest piece of type.
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-action py-3.5 text-xs font-semibold uppercase tracking-wide text-on-action transition-opacity hover:opacity-90"
    >
      <ShoppingCart size={15} strokeWidth={1.75} />
      Add to cart
    </button>
  );
}
