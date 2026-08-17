"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  Wallet,
  X,
} from "lucide-react";

import WhatsappIcon from "@/components/common/WhatsappIcon";
import StickyCta from "@/components/checkout/StickyCta";
import { CATEGORIES } from "@/data/catalog";
import { WHATSAPP_NUMBER } from "@/data/footer";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { gtmItem, gtmItems, pushAddToWishlist, pushViewCart } from "@/lib/gtm";
import { syncCart } from "@/redux/features/cart/cartSlice";
import { openAuthModal } from "@/redux/features/user/userSlice";
import { useAuth } from "@/hooks/useAuth";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useRehydrated } from "@/hooks/useRehydrated";
import { checkPincode } from "@/lib/delivery";
import { GST_RATE } from "@/lib/delivery-charges";
import { addGuestWishlistItem } from "@/redux/features/wishlist/wishlistSlice";
import { formatPrice } from "@/utils/formatPrice";

/**
 * The cart: review, adjust, check out.
 *
 * For materials this page is not a formality -- an order is fifteen boxes chosen through a
 * calculator, and the customer arrives here to confirm the sum before committing. So every line
 * carries the WHY (the Area / Covers / Wastage attributes the PDP wrote onto it), the quantity is
 * editable in place, and there is exactly one action: Shopify's own hosted checkout.
 *
 * ponytail: no coupon field (no coupons exist), no saved-for-later, no cross-sell rail. A cart
 * page's conversion job is to not get in the way.
 */
export default function CartPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const hasMounted = useHasMounted();
  const rehydrated = useRehydrated();
  const { isAuthenticated, openLogin } = useAuth();
  const { items, totalQuantity, totalAmount, subtotal, totalWeightKg, appliedCoupon, checkoutUrl, loading, error } =
    useSelector((state) => state.cart);

  // What the coupon actually took off, as the difference between Shopify's own two figures rather
  // than a percentage this page would have to know. Guarded because a cart rehydrated from an older
  // localStorage snapshot has no `subtotal` at all, and `0 - 27668` would print a discount nobody
  // was given.
  const saving = subtotal > totalAmount ? subtotal - totalAmount : 0;

  // Shopify's checkout would reject an out-of-stock line anyway; better to say so here than to let
  // someone reach the payment step and bounce.
  const hasUnavailableLine = items.some((item) => item.inStock === false);

  // Shopify quotes tax-inclusive prices on an Indian storefront, so the GST line is extracted from
  // the total, never added to it.
  // The pincode the customer already gave us on a PDP. Checked, not assumed.
  const pincode = useSelector((state) => state.user.pincode);
  const pincodeStatus = (() => {
    if (!pincode) return null;
    const result = checkPincode(pincode);
    if (result.status === "invalid") return null;
    return { serviceable: result.status === "serviceable" };
  })();

  const taxableBase = Math.round((totalAmount / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableBase) * 100) / 100;

  // The line the trash icon is asking about. Null when nothing is pending.
  const [pendingRemoval, setPendingRemoval] = useState(null);

  useEffect(() => {
    if (!pendingRemoval) return;
    const onKey = (e) => e.key === "Escape" && setPendingRemoval(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingRemoval]);

  // The slice is persisted, but localStorage is a snapshot, not the truth -- the cookie-backed
  // cart may have expired or been edited in another tab. One GET on mount settles it.
  useEffect(() => {
    dispatch(syncCart({}));
  }, [dispatch]);

  /**
   * viewCart, once, when there is a cart to have viewed.
   *
   * Fired from the PAGE rather than from the syncCart listener that owns addToCart/removeFromCart:
   * the header, the shipping step and the payment step all sync the cart on mount, and "the cart
   * was fetched" is not "the customer is looking at their cart". A ref rather than a dependency
   * on `items`, because the GET above lands a second later and would otherwise report the
   * rehydrated snapshot and then the fresh copy as two views of one cart.
   */
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current || !hasMounted || loading || items.length === 0) return;
    viewedRef.current = true;
    pushViewCart({
      currency: "INR",
      cart_total: totalAmount,
      // Pre-discount, so a container can read what the coupon took off without recomputing it.
      subtotal,
      discount_amount: saving,
      coupon: appliedCoupon?.code || "NA",
      total_quantity: totalQuantity,
      total_product: items.length,
      items: gtmItems(items),
    });
  }, [hasMounted, loading, items, totalAmount, subtotal, saving, appliedCoupon, totalQuantity]);

  // The slice rehydrates from localStorage, so rendering it before mount disagrees with the
  // server-rendered shell -- same guard as ProductCard's wishlist.
  if (!hasMounted) return <div className="min-h-[50vh]" />;

  const setQuantity = (lineId, quantity) => dispatch(syncCart({ update: { lineId, quantity } }));

  // The empty cart owns the WHOLE page, heading included -- see EmptyCart. A left-ragged "Your
  // cart" over a centred block is two compositions arguing, and the count beside it is only ever
  // "0" here.
  if (items.length === 0) return <EmptyCart />;

  return (
    <div className="container-main mt-6 pb-16 max-lg:pb-28 lg:mt-8 lg:pb-24">
      <h1 className="font-display text-xl tracking-[-0.02em] text-ink lg:text-2xl">
        Your cart
        {totalQuantity > 0 && (
          <span className="num ml-2 text-sm font-normal text-subtle">
            {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
          </span>
        )}
      </h1>

      {/* REMOVE, OR KEEP IT SOMEWHERE. A line in this cart was chosen through the PDP calculator --
          200 sq ft became 15 boxes -- so a one-tap delete throws away real work, and people who
          remove an item from a materials order are usually still deciding rather than rejecting.
          Saving it is the answer they actually wanted about half the time. */}
      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setPendingRemoval(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-sm border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Remove from cart"
          >
            {/* Dismissing is not a third choice, so it is not a third button. An X, the backdrop and
                Escape all mean "I changed my mind"; the two buttons are the only real decisions. */}
            <button
              type="button"
              onClick={() => setPendingRemoval(null)}
              aria-label="Close"
              className="absolute right-3 top-3 p-1 text-meta transition-colors hover:text-ink"
            >
              <X size={18} strokeWidth={1.75} />
            </button>

            <div className="flex gap-3 pr-6">
              <span className="relative block aspect-swatch w-14 shrink-0 overflow-hidden border border-line bg-paper">
                {pendingRemoval.image && (
                  <Image src={pendingRemoval.image} alt="" fill sizes="56px" className="object-cover" />
                )}
              </span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm text-ink">{pendingRemoval.title}</p>
                <p className="num mt-0.5 text-xs text-meta">
                  {pendingRemoval.quantity} × ₹{formatPrice(pendingRemoval.price)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-subtle">Remove this from your cart?</p>

            {/* Side by side: these are two alternatives, not a primary and its afterthought.
                Stacked, the second button reads as the lesser option purely because it is lower.
                They stack again below 380px, where two labels stop fitting on one row. */}
            <div className="mt-4 flex flex-col gap-2 min-[380px]:flex-row">
              <button
                type="button"
                onClick={() => {
                  // Saved first, removed second -- if the remove fails the customer still has it.
                  dispatch(
                    addGuestWishlistItem({
                      productId: pendingRemoval.handle,
                      productHandle: pendingRemoval.handle,
                      title: pendingRemoval.title,
                      image: pendingRemoval.image,
                      price: pendingRemoval.price,
                      comparePrice: pendingRemoval.comparePrice ?? "",
                    }),
                  );
                  pushAddToWishlist(gtmItem(pendingRemoval));
                  // removeFromCart is NOT pushed here -- setQuantity dispatches syncCart, and the
                  // listener on it fires the removal. See redux/gtmListener.js.
                  setQuantity(pendingRemoval.lineId, 0);
                  setPendingRemoval(null);
                }}
                className="flex-1 bg-action px-3 py-3 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90"
              >
                Move to saved items
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuantity(pendingRemoval.lineId, 0);
                  setPendingRemoval(null);
                }}
                className="flex-1 border border-line px-3 py-3 text-xs uppercase tracking-wide text-ink transition-colors hover:border-bad hover:text-bad"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {(
        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* ================================== LINES ================================== */}
          <ul className="lg:col-span-8">
            {items.map((item) => (
              <li
                key={item.lineId}
                className="flex gap-3.5 border-b border-line py-4 first:border-t"
              >
                {/* ONE CARD, ONE SHAPE, at every width (user, 2026-08-15). The compact version was
                    designed for a 360px screen and there is nothing about it a desktop needs undone:
                    a line that changes proportions between breakpoints is two designs to keep, and
                    the wide one was only ever wider because it could be.
                    96px square: the line is a fixed stack of text rows whatever the image does, and
                    an 80px thumbnail left a blank column beside it -- which is what read as
                    elongated. */}
                <Link
                  href={`/products/${item.handle}`}
                  prefetch={false}
                  className="relative block aspect-swatch w-24 shrink-0 overflow-hidden rounded-sm border border-line bg-paper"
                >
                  {item.image && (
                    <Image src={item.image} alt="" fill sizes="96px" className="object-cover" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/products/${item.handle}`} prefetch={false}>
                        <h2 className="line-clamp-2 text-sm leading-snug text-ink underline-offset-4 hover:underline">
                          {item.title}
                        </h2>
                      </Link>
                      {/* Variant, SKU and weight on one line. The SKU is what a customer reads out
                          on the phone and what a site foreman writes on a wall -- it is the name the
                          material actually goes by once it leaves this website. */}
                      <p className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                        {item.variantTitle && item.variantTitle !== "Default Title" && (
                          <span>{item.variantTitle}</span>
                        )}
                        {item.sku && <span className="text-meta">SKU {item.sku}</span>}
                        {item.weightKg > 0 && <span className="text-meta">{item.weightKg} kg</span>}
                      </p>
                      {/* The order's reasoning, straight off the line attributes the PDP wrote:
                          "Area: 200 sq ft · Covers: 232.5 sq ft · Wastage: 10%". */}
                      {Object.keys(item.properties ?? {}).length > 0 && (
                        // One line, everywhere. The full working (Area · Covers · Wastage) is a
                        // calculation the customer did themselves two screens ago; it is a reminder,
                        // not a document.
                        <p className="num mt-1 line-clamp-1 text-[11px] text-meta">
                          {Object.entries(item.properties)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </p>
                      )}
                    </div>

                    {/* Asks before deleting, and offers the middle answer. Someone removing a line
                        from a ₹27,000 order is usually still deciding, not rejecting -- and a
                        one-tap delete of an item chosen through a calculator is work thrown away. */}
                    <button
                      type="button"
                      onClick={() => setPendingRemoval(item)}
                      disabled={loading}
                      aria-label={`Remove ${item.title} from cart`}
                      className="shrink-0 cursor-pointer p-1 text-subtle transition-colors hover:text-bad disabled:opacity-40"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* STOCK, per line. The anxiety on a materials order is not "will it arrive" but
                      "is it actually there" -- a cart that says nothing and then emails an
                      out-of-stock two days later costs the order and the customer. Only stated when
                      Shopify actually knows: untracked inventory says nothing rather than guessing. */}
                  {/* Stock and unit price share a row: two short facts that each used to take a
                      whole line of a narrow screen. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {!item.inStock ? (
                    <p className="flex items-center gap-1.5 text-xs text-bad">
                      <span className="size-1.5 rounded-full bg-bad" />
                      Out of stock — remove it to check out
                    </p>
                  ) : item.stockLeft !== null && item.stockLeft <= item.quantity ? (
                    <p className="num flex items-center gap-1.5 text-xs text-warn">
                      <span className="size-1.5 rounded-full bg-warn" />
                      Only {item.stockLeft} left
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-good">
                      <span className="size-1.5 rounded-full bg-good" />
                      In stock
                    </p>
                  )}

                  {/* Unit price, and what it was. A cart that only shows a line total makes the
                      customer do the division to check the price they were quoted on the PDP. */}
                  <p className="num flex items-baseline gap-2 text-xs">
                    <span className="text-subtle">₹{formatPrice(item.price)} each</span>
                    {item.comparePrice > item.price && (
                      <>
                        <span className="text-meta line-through">
                          ₹{formatPrice(item.comparePrice)}
                        </span>
                        <span className="text-good">
                          {Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}%
                          off
                        </span>
                      </>
                    )}
                  </p>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
                    <span className="flex items-center rounded-sm border border-line">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.lineId, item.quantity - 1)}
                        disabled={loading}
                        aria-label="One fewer"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center text-subtle hover:text-ink disabled:opacity-40"
                      >
                        <Minus size={13} strokeWidth={2} />
                      </button>
                      <span className="num min-w-8 text-center text-sm text-ink">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.lineId, item.quantity + 1)}
                        disabled={loading || item.quantity >= 999}
                        aria-label="One more"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center text-subtle hover:text-ink disabled:opacity-40"
                      >
                        <Plus size={13} strokeWidth={2} />
                      </button>
                    </span>

                    <p className="num text-sm font-semibold text-ink">
                      ₹{formatPrice(item.total)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ================================= SUMMARY ================================= */}
          <div className="lg:col-span-4">
            <div className="rounded-sm border border-line bg-surface p-5 lg:sticky lg:top-40">
              {/* THE FULL BREAKDOWN, not one number. A contractor on a ₹27,000 order needs to see
                  the tax to claim it back, and a customer who applied a coupon needs to see it
                  landed. GST is EXTRACTED from the total rather than added: Indian storefront prices
                  are tax-inclusive, so adding 18% on top would overcharge every order by 18%. */}
              <dl className="num flex flex-col gap-1.5 text-sm">
                <div className="flex items-baseline justify-between text-subtle">
                  <dt>
                    Subtotal
                    <span className="ml-1 text-meta">excl. GST</span>
                  </dt>
                  <dd>₹{formatPrice(taxableBase)}</dd>
                </div>

                <div className="flex items-baseline justify-between text-subtle">
                  <dt>GST (18%)</dt>
                  <dd>₹{formatPrice(gstAmount)}</dd>
                </div>

                {saving > 0 && (
                  <div className="flex items-baseline justify-between text-good">
                    <dt>Discount{appliedCoupon?.code ? ` · ${appliedCoupon.code}` : ""}</dt>
                    <dd>−₹{formatPrice(saving)}</dd>
                  </div>
                )}

                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2.5 text-ink">
                  <dt>Total</dt>
                  <dd className="text-base font-semibold">₹{formatPrice(totalAmount)}</dd>
                </div>
              </dl>

              {/* The "freight is quoted before you pay" line is gone: the next step now quotes it
                  for real, with a figure, so promising it here was announcing something the customer
                  is about to see anyway. Named, not badged. "Delivering to 400050" is a fact the customer can check; a
                  generic "we deliver fast" ribbon is one they cannot. Only shown once they have
                  actually given us a pincode. */}
              {pincodeStatus && (
                <p
                  className={`num mt-1.5 flex items-center gap-1.5 text-xs ${
                    pincodeStatus.serviceable ? "text-good" : "text-warn"
                  }`}
                >
                  <Truck size={13} strokeWidth={1.6} className="shrink-0" />
                  {pincodeStatus.serviceable
                    ? `Delivering to ${pincode} · inside our area`
                    : `${pincode} is outside our usual area — we'll call to confirm`}
                </p>
              )}

              {/* onApply RETURNS the dispatch promise -- that is what lets the field own its own
                  pending state instead of reading the cart's, so editing a box quantity elsewhere on
                  the page no longer greys out the Apply button. */}
              <CouponField
                applied={appliedCoupon}
                saving={saving}
                onApply={(code) => dispatch(syncCart({ coupon: code })).unwrap()}
              />

              {/* Checkout requires an account: partial-COD is credit extended on delivery, so an
                  order has to be attached to a verified phone number. A signed-out customer gets the
                  same dialog the header and the 15s popup open, with this page as the redirect --
                  they land back here signed in, cart intact, rather than on the homepage.
                  Rehydration is why this is not a plain `isAuthenticated` check: on the first render
                  everyone looks signed out, and a returning customer must not be sent to sign in
                  again. See src/hooks/useRehydrated.js. */}
              <StickyCta
                note={
                  // On the pinned bar the button is out of sight of the total it is charging, so it
                  // brings the number with it.
                  <p className="num mt-2 text-center text-xs text-meta">
                    Total ₹{formatPrice(totalAmount)} · {totalQuantity}{" "}
                    {totalQuantity === 1 ? "item" : "items"}
                  </p>
                }
              >
              <button
                type="button"
                disabled={!rehydrated || hasUnavailableLine}
                onClick={() => {
                  if (!isAuthenticated) return dispatch(openAuthModal({ redirectPath: "/checkout/shipping", source: "cart-checkout" }));
                  // OUR checkout, not Shopify's hosted one. Shopify's collects its own address and
                  // has nowhere to put a floor or a lift, so it cannot quote what it costs to carry
                  // 900kg up four flights -- and it cannot do partial-COD at all. Both are the
                  // reason this store owns the last three steps.
                  router.push("/checkout/shipping");
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-sm bg-action py-3.5 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90 lg:mt-5 ${
                  rehydrated ? "" : "pointer-events-none opacity-60"
                }`}
              >
                Proceed to checkout
                <ArrowRight size={15} strokeWidth={1.75} />
              </button>
              </StickyCta>

              {/* The "secure checkout" line that used to open this list is gone (user, 2026-08-15):
                  the checkout header now carries it, in a lock and the same words, roughly 400px up
                  the same screen. Saying it twice on one page makes it read as a slogan rather than
                  a fact. */}
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-subtle">
                <li className="flex items-center gap-2">
                  <Truck size={13} strokeWidth={1.5} className="shrink-0" />
                  Delivered across Mumbai and MMR
                </li>
                <li className="flex items-center gap-2">
                  <Wallet size={13} strokeWidth={1.5} className="shrink-0" />
                  Samples refunded against your order
                </li>
              </ul>
            </div>

            {error && <p className="mt-3 text-xs text-bad">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- pieces */

/**
 * The empty cart.
 *
 * WHY IT IS MORE THAN A SENTENCE AND A BUTTON. This page has no site header and no footer -- the
 * checkout layout strips both on purpose -- so an empty cart here is the only screen on the site
 * with NO navigation on it at all. What was here before was one line of prose and a single button
 * to "/", left-ragged in the top corner of a 1440px window: a page that reads as broken, and a
 * customer one wrong click from having nowhere to go. Stripping the chrome made this state the one
 * that had to earn its own way out.
 *
 * SO THE EXITS ARE THE CONTENT. Three category cards rather than one "Browse materials" button,
 * because the homepage is a step nobody wanted -- tiles, laminates and wallpaper are where they
 * were going, and CATEGORIES is a static export so this costs no request. Photographs rather than
 * text links: this is a materials shop, and the picture is the thing being chosen.
 *
 * AND THE OTHER WAY OUT IS A PERSON. Someone whose cart is empty on a tile store has often not
 * failed to add something -- they have not worked out what to add. In this market that question
 * gets answered in chat, so the WhatsApp line is the second exit rather than a footnote. It drops
 * out silently when no number is configured.
 *
 * NOT HERE: recently-viewed and the saved/wishlist items. Both are real recovery paths and both are
 * worth adding -- but they read from localStorage-backed slices, which means a mount guard and an
 * empty-shelf case of their own inside an empty state. Add them when there is a reason to believe
 * customers arrive here with either.
 */
function EmptyCart() {
  const help =
    WHATSAPP_NUMBER &&
    buildWhatsappLink(WHATSAPP_NUMBER, [
      "Hi Material, I'm looking for something for my space — can you help me choose?",
    ]);

  return (
    // Centred, and vertically generous: this is the whole page now, and a block pinned to the top
    // of an otherwise blank screen is what made the old one look like a failed render.
    <div className="container-main flex flex-col items-center py-14 text-center lg:py-20">
      <ShoppingBag size={26} strokeWidth={1.25} className="text-line-strong" aria-hidden="true" />

      <h1 className="mt-5 font-display text-xl tracking-[-0.02em] text-ink lg:text-2xl">
        Your cart is empty
      </h1>
      <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-subtle">
        Nothing in it yet. Start with a category below, or tell us about the room and we will work
        out what you need.
      </p>

      <ul className="mt-9 grid w-full max-w-2xl grid-cols-3 gap-3 lg:mt-11 lg:gap-5">
        {CATEGORIES.map((category) => (
          <li key={category.handle}>
            <Link href={`/collections/${category.handle}`} className="group block">
              {/* aspect-[4/3] and a hairline border, the same tile CategorySheet draws on the
                  homepage -- one shape for "a category", wherever it appears. */}
              <span className="relative block aspect-[4/3] overflow-hidden rounded-sm border border-line bg-surface">
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 220px, 30vw"
                  className="object-cover"
                />
              </span>
              <span className="mt-2.5 block text-xs text-ink underline-offset-4 group-hover:underline lg:text-sm">
                {category.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {help && (
        <a
          href={help}
          target="_blank"
          rel="noopener noreferrer"
          // WhatsApp's own green on the mark, but a quiet outlined control rather than a filled
          // one: the categories above are the primary way out, and two filled buttons in a centred
          // column is two primaries.
          className="mt-9 inline-flex items-center gap-2.5 rounded-sm border border-line-strong px-5 py-3 text-sm text-ink transition-colors hover:border-ink lg:mt-11"
        >
          <WhatsappIcon className="size-[17px] shrink-0 text-[#128C7E]" />
          Not sure what you need? Ask us
        </a>
      )}
    </div>
  );
}

/**
 * The coupon field.
 *
 * SHOPIFY IS THE VALIDATOR. There is no coupon table in this repo and no /api/cart/coupon/validate
 * to go with it: the code is handed to the same cart the checkout will read, and Shopify answers by
 * holding it with `applicable: true` or `false`. That is the whole feature. The jewelry build runs
 * the other version -- lib/coupons.js, a drawer of tappable offer cards, a validate endpoint, a
 * re-validation effect on every cart change, and rules about which coupons can combine with loyalty
 * points -- which is a second discount engine that can disagree with the checkout's.
 *
 * THREE STATES, and the middle one is the one most coupon fields get wrong:
 *   applied     -- Shopify honours it. The saving is already in the summary above.
 *   not applied -- Shopify is holding a code it will not honour. NOT an error style: the code may
 *                  be real and simply not cover tiles, or not have reached its minimum yet, so this
 *                  says what happened rather than calling the customer wrong.
 *   empty       -- collapsed to a link. A cart with no coupon should not open with a field implying
 *                  the customer is missing a deal they were never offered.
 *
 * ponytail: no debounce and no per-keystroke validation. A coupon is typed once and submitted once.
 */
function CouponField({ applied, saving, onApply }) {
  // OPENED BY THE CUSTOMER, or by a rejection that needs explaining -- never by `applied` alone.
  // It was `useState(Boolean(applied))`, and `appliedCoupon` is persisted to localStorage (only
  // loading and error are blacklisted in store.js), so a coupon from a session days ago opened this
  // field on every load before syncCart had come back to say the cart no longer carries it.
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState("");
  // THIS FIELD's request, not the cart's. `loading` on the slice is true for any cart mutation, so
  // reading it here greyed out Apply while an unrelated quantity stepper was in flight.
  const [busy, setBusy] = useState(false);

  const submit = async (value) => {
    setBusy(true);
    try {
      await onApply(value);
    } catch {
      /* the slice already put the message in state.error, which renders under the summary */
    } finally {
      setBusy(false);
    }
  };

  if (applied?.applicable) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-sm border border-good/30 bg-good/5 px-3 py-2.5">
        <Tag size={14} strokeWidth={1.5} className="shrink-0 text-good" />
        <span className="min-w-0 flex-1">
          <span className="num block truncate text-xs font-medium text-ink">{applied.code}</span>
          {/* THE SAVING, on the coupon itself. It is also in the Discount row above, and that is
              not a duplicate worth removing: the row explains the arithmetic of the total, this
              answers "was it worth applying?" at the control that applied it. */}
          {saving > 0 && (
            <span className="num block text-[11px] text-good">
              ₹{formatPrice(saving)} off this order
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => submit("")}
          disabled={busy}
          className="shrink-0 cursor-pointer text-xs text-subtle underline underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          {busy ? "Removing" : "Remove"}
        </button>
      </div>
    );
  }

  // The rejection belongs to the code that is still in the box. Once it is edited it is about
  // something that is no longer on screen, so it goes.
  const showRejection =
    applied && !applied.applicable && code.trim().toUpperCase() === applied.code.toUpperCase();

  // Derived, not stored: the field cannot collapse while it is still explaining a rejected code.
  const open = opened || Boolean(showRejection);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-subtle underline underline-offset-4 hover:text-ink"
      >
        <Tag size={13} strokeWidth={1.5} className="shrink-0" />
        Have a coupon code?
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) submit(trimmed);
      }}
      className="mt-4"
    >
      <div className="flex gap-2">
        {/* Uppercase is DISPLAY only -- the value is sent as typed, because Shopify's codes are
            case-insensitive and nothing here should rewrite what someone entered before it has been
            checked. autoCapitalize matches on a phone keyboard so the two agree. */}
        <input
          name="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Coupon code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="num min-w-0 flex-1 rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-sm uppercase text-ink outline-none transition-colors placeholder:normal-case placeholder:text-meta focus:border-action"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-sm border border-line-strong px-4 text-xs uppercase tracking-wide text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
          {busy ? "Checking" : "Apply"}
        </button>
      </div>

      {/* Shopify took the code and will not honour it. Deliberately not red: "not valid for this
          order" is usually a minimum spend or a collection restriction, not a typo, and the
          customer is not being told off.

          It HIDES THE MOMENT THE FIELD IS EDITED -- `showRejection` compares what is typed against
          the code that was rejected, so a message about SAVE10 cannot sit under a field that now
          reads SAVE20. Same rule as ProductPage's `touch()`: a complaint about the last attempt
          must not read as a complaint about the one being typed. No extra state needed for it. */}
      {showRejection && (
        <p className="mt-2 text-xs text-warn">
          <span className="num">{applied.code}</span> is not valid for this order.
        </p>
      )}
    </form>
  );
}
