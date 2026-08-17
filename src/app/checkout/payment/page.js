"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Image from "next/image";
import {
  ChevronLeft,
  FileText,
  Headphones,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, fetchCustomerAddresses } from "@/lib/api";
import { advanceFor, PAYMENT_MODES } from "@/lib/payment-modes";
import { GST_RATE, unloadingCharge } from "@/lib/delivery-charges";
import { getStoredUtms } from "@/lib/attribution";
import {
  GTM_PURCHASE_KEY,
  gtmCheckout,
  pushAddPaymentInfo,
  pushAddShippingInfo,
  pushPaymentFailure,
} from "@/lib/gtm";
import StickyCta from "@/components/checkout/StickyCta";
import { syncCart } from "@/redux/features/cart/cartSlice";
import { useRehydrated } from "@/hooks/useRehydrated";
import { formatPrice } from "@/utils/formatPrice";

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * The stable half of a customer address id, and the reason this page could not price a carry.
 *
 * Shopify hands back
 *   gid://shopify/MailingAddress/1100377…?model_name=CustomerAddress&customer_access_token=…
 *
 * — the SESSION'S ACCESS TOKEN is inside the id. The shipping page put that whole string in the URL;
 * this page fetched the addresses again and compared. The moment the token differs (a refreshed
 * session, a reopened tab) nothing matched, so the address resolved to null, so the floor and lift
 * were unknown, so the doorstep charge quoted one screen earlier silently became "to be confirmed"
 * — while the server, which keys on the numeric id, went on billing it.
 *
 * The backend has had `addressMeta.addressKey` for exactly this since the beginning.
 */
const addressKey = (gid) => String(gid || "").match(/MailingAddress\/(\d+)/)?.[1] || String(gid || "");

function PaymentInner() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useSearchParams();
  const rehydrated = useRehydrated();

  const addressId = params.get("address");
  // Absent on a link from an older tab; the server falls back to the delivery address, which is what
  // "same as delivery" means anyway.
  const billingAddressId = params.get("billing");
  // The rest of what the shipping step collected. It used to arrive here and go no further; the
  // delivery option prices the carry and the other three are what the invoice is made out to, so
  // all four now travel to the server with the order.
  const deliveryOption = params.get("delivery") === "doorstep" ? "doorstep" : "ground";
  const invoiceEmail = params.get("email") || "";
  const gstin = params.get("gstin") || "";
  const company = params.get("company") || "";
  const user = useSelector((state) => state.user.user);
  const accessToken = useSelector((state) => state.user.accessToken);
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);
  const { items, totalAmount, totalQuantity, cartId, totalWeightKg, appliedCoupon } = useSelector(
    (state) => state.cart,
  );

  // Full payment by default: it is the cheaper promise to keep and the one with no doorstep cash to
  // count. Part-payment is offered, not pushed.
  const [paymentMode, setPaymentMode] = useState("full");
  const [sdkReady, setSdkReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  // Where it is going, shown rather than assumed. The customer chose this address one screen ago and
  // is about to pay against it; making them go back to check is how a confident checkout loses one.
  // It also carries the floor and lift answers, which is what the carry is priced from.
  const [shipTo, setShipTo] = useState(null);
  const [shipToLoaded, setShipToLoaded] = useState(false);
  useEffect(() => {
    if (!accessToken || !addressId) return;
    let live = true;
    fetchCustomerAddresses(accessToken)
      .then((data) => {
        if (!live) return;
        setShipTo(
          (data?.addresses || []).find((a) => addressKey(a.id) === addressKey(addressId)) || null,
        );
      })
      // A recap that fails to load is not worth an error on a payment page; the address id is still
      // what the order is built from.
      .catch(() => {})
      .finally(() => live && setShipToLoaded(true));
    return () => {
      live = false;
    };
  }, [accessToken, addressId]);

  // The carry. Quoted on the shipping page, quoted again here from the same table, and CHARGED by
  // the server from its own copy -- the browser never names a price. Showing it here is the point:
  // the shipping page used to add it to the total and this page used to drop it, so the customer
  // watched the amount fall by ₹300+ between two screens and the crew carried it up for free.
  const unloading = unloadingCharge({
    option: deliveryOption,
    weightKg: totalWeightKg,
    floor: shipTo?.floor,
    liftAvailable: shipTo?.liftAvailable,
  });
  const orderTotal = totalAmount + unloading.amount;

  // Quoted here, charged by the server. Both compute it the same way from the same total; the page
  // only needs a number to put on a button before the customer commits.
  const advance = advanceFor(orderTotal);
  const payableNow = paymentMode === "ppcod" ? advance : orderTotal;
  const balanceDue = Math.max(0, orderTotal - advance);

  // Shopify quotes tax-inclusive on an Indian storefront, so GST is extracted from the goods total,
  // never added to it. Same arithmetic as the cart and shipping pages, and it has to agree with
  // them -- a total that changes between two screens is the loudest possible reason to abandon a
  // checkout. The unloading charge sits outside this: it is a service line, taxed on its own terms.
  const taxableBase = Math.round((totalAmount / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableBase) * 100) / 100;

  /**
   * Two refs, both learned from GlassQuick's production incidents.
   *
   * paidRef — Razorpay fires `ondismiss` AFTER a successful payment when the modal closes. Without
   *   this flag the dismissal handler treats a completed order as an abandonment.
   *
   * failedRef — a failed attempt is NOT terminal. Razorpay keeps its modal open and lets the
   *   customer retry on the SAME order id, and that retry can succeed. GlassQuick used to cancel the
   *   order on `payment.failed`, so a successful retry then failed verification: money taken, no
   *   order. Seen live. Record it, and only act on it once the modal actually closes.
   */
  const paidRef = useRef(false);
  const failedRef = useRef(null);

  useEffect(() => {
    dispatch(syncCart());
  }, [dispatch]);

  useEffect(() => {
    if (rehydrated && !isAuthenticated) router.replace("/checkout/cart");
  }, [rehydrated, isAuthenticated, router]);

  useEffect(() => {
    if (rehydrated && !addressId) router.replace("/checkout/shipping");
  }, [rehydrated, addressId, router]);

  /**
   * add_shipping_info, on ARRIVING here.
   *
   * Landing on this page IS the shipping step completed -- the address, the delivery option and
   * the invoice details are all in the query string that got us here, and the previous screen
   * refuses to push without them. Firing it on the shipping page's own submit would count an
   * attempt that failed validation, and there is nowhere else to put it.
   *
   * Waits for `shipToLoaded` so the delivery option and unloading charge in the payload are the
   * quoted ones, not zero. Once per visit, via the ref.
   */
  const shippingSentRef = useRef(false);
  useEffect(() => {
    if (shippingSentRef.current || !rehydrated || !shipToLoaded || items.length === 0) return;
    shippingSentRef.current = true;
    pushAddShippingInfo(
      gtmCheckout({
        items,
        // The goods plus the carry, which is what the customer is about to be asked for.
        value: orderTotal,
        coupon: appliedCoupon?.code,
        checkout_step: "payment",
        shipping_tier: deliveryOption,
        shipping: unloading.amount,
      }),
    );
  }, [
    rehydrated,
    shipToLoaded,
    items,
    orderTotal,
    appliedCoupon,
    deliveryOption,
    unloading.amount,
  ]);

  // Loaded here rather than in the root layout: the SDK is ~90KB and every other page on the site
  // has no use for it.
  useEffect(() => {
    if (window.Razorpay) return setSdkReady(true);
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Could not reach the payment provider. Check your connection.");
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  const pay = useCallback(async () => {
    setError(null);
    setPaying(true);
    paidRef.current = false;
    failedRef.current = null;

    try {
      // The server reads the amount off the Shopify cart. Nothing here sends a price.
      const order = await apiFetch("/api/payment/razorpay/order", {
        method: "POST",
        // A MODE and an OPTION, never an amount. The server decides what 25% of this cart is, and
        // what carrying it up four floors costs.
        body: JSON.stringify({
          cartId,
          addressId,
          billingAddressId,
          paymentMode,
          deliveryOption,
          invoiceEmail,
          gstin,
          company,
          // The campaign that earned this order, carried from the landing page. Sent at pay time
          // rather than stored per-session on the server: the browser is where it was captured and
          // this is the one request that turns it into revenue.
          utms: getStoredUtms(),
        }),
      });

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
        name: "Material",
        description:
          `${order.totalQuantity} ${order.totalQuantity === 1 ? "item" : "items"}` +
          (order.paymentMode === "ppcod" ? " · advance payment" : ""),
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.mobile ? String(user.mobile).replace(/^91/, "") : "",
        },
        theme: { color: "#e4551a" },

        handler: async (response) => {
          // Money has moved. Mark it before anything else can run.
          paidRef.current = true;
          try {
            const done = await apiFetch("/api/payment/razorpay/complete", {
              method: "POST",
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            // The two facts only the confirmation knows, folded into the payload written before
            // the modal opened. The success page fires it -- see GTM_PURCHASE_KEY in lib/gtm.js.
            try {
              const stashed = JSON.parse(window.localStorage.getItem(GTM_PURCHASE_KEY) || "null");
              if (stashed) {
                stashed.transaction_id = response.razorpay_payment_id;
                stashed.order_name = done.orderName || "";
                window.localStorage.setItem(GTM_PURCHASE_KEY, JSON.stringify(stashed));
              }
            } catch {
              // Analytics must never be the reason a paid customer does not reach their receipt.
            }

            dispatch(syncCart());
            router.replace(
              `/checkout/success?order=${encodeURIComponent(done.orderName || "")}`,
            );
          } catch (err) {
            // Paid, but the order did not land. Never say "payment failed" here — it did not, and
            // the payment id is the customer's evidence.
            setError(
              `Your payment went through (${response.razorpay_payment_id}) but we could not confirm the order. ` +
                `Please contact us with that reference — do not pay again.`,
            );
            setPaying(false);
          }
        },

        modal: {
          ondismiss: () => {
            if (paidRef.current) return; // success already handled this
            setPaying(false);
            setError(
              failedRef.current
                ? `${failedRef.current} Nothing has been charged — you can try again.`
                : null,
            );
          },
        },
      });

      rzp.on("payment.failed", (response) => {
        // Recorded, not acted on: the modal stays open and the retry may succeed.
        failedRef.current = response?.error?.description || "That payment did not go through.";
        // Pushed straight away rather than stashed for a /failure page: this store has none, the
        // modal stays open, and a retry that succeeds must still leave the failed attempt on
        // record. `payment.failed` is the ONLY thing that fires this -- an order that could not be
        // confirmed AFTER the money moved is not a payment failure and is handled in `handler`.
        pushPaymentFailure(
          gtmCheckout({
            items,
            value: payableNow,
            coupon: appliedCoupon?.code,
            payment_type: paymentMode === "ppcod" ? "Partial COD" : "Razorpay",
            error_code: response?.error?.code || "",
            error_reason: response?.error?.reason || "",
            error_message: failedRef.current,
          }),
        );
      });

      /**
       * add_payment_info, as the Razorpay modal opens -- the payment method is chosen and the
       * customer is committing, which is what the step measures. Not after success: that is
       * `purchase`, and firing both off one event makes the drop-off between them always zero.
       */
      pushAddPaymentInfo(
        gtmCheckout({
          items,
          // What is being charged NOW. On part-payment that is the advance, not the order total --
          // the balance is collected at the door and is not this transaction.
          value: payableNow,
          coupon: appliedCoupon?.code,
          payment_type: paymentMode === "ppcod" ? "Partial COD" : "Razorpay",
          order_total: orderTotal,
        }),
      );

      /**
       * The purchase payload, written down BEFORE the modal opens.
       *
       * The success page is a redirect away and the cart is re-synced (emptied) on the way, so by
       * the time it renders there are no line items left to report. Everything `purchase` needs
       * exists here; the transaction id is filled in by the handler and the success page fires it.
       * Same approach as the jewelry build, for the same reason.
       */
      window.localStorage.setItem(
        GTM_PURCHASE_KEY,
        JSON.stringify(
          gtmCheckout({
            items,
            value: payableNow,
            coupon: appliedCoupon?.code,
            affiliation: "Material",
            payment_type: paymentMode === "ppcod" ? "Partial COD" : "Razorpay",
            // Shopify quotes tax-inclusive on an Indian storefront, so GST is EXTRACTED from the
            // goods total, never added. Same arithmetic as the summary above this button.
            tax: gstAmount,
            shipping: unloading.amount,
            order_total: orderTotal,
          }),
        ),
      );

      rzp.open();
    } catch (err) {
      setError(err?.message || "Could not start the payment. Please try again.");
      setPaying(false);
    }
  }, [
    cartId,
    addressId,
    billingAddressId,
    paymentMode,
    deliveryOption,
    invoiceEmail,
    gstin,
    company,
    user,
    dispatch,
    router,
    // Read inside for the analytics payloads only; none of them change what is charged.
    items,
    appliedCoupon,
    payableNow,
    orderTotal,
    gstAmount,
    unloading.amount,
  ]);

  if (!rehydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-subtle" />
      </div>
    );
  }

  // ...unless we just emptied it ourselves. The order is placed, the cart is gone, and the redirect
  // to the confirmation page is one tick away -- telling that customer their cart is empty is how a
  // paid order looks like a lost one for a beat. The overlay below covers the gap instead.
  if (items.length === 0 && !paidRef.current) {
    return (
      <div className="container-main py-16 text-center">
        <p className="text-sm text-subtle">Your cart is empty.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-action-ink underline underline-offset-2">
          Browse materials
        </Link>
      </div>
    );
  }

  return (
    <div className="container-main py-8 max-lg:pb-28 lg:py-12">
      <Link
        href="/checkout/shipping"
        className="inline-flex items-center gap-1 text-sm text-subtle hover:text-ink"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
        Back to address
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:gap-10">
        {/* ================= THE CHOICE ================= */}
        <div className="lg:col-span-7">
          <h1 className="font-display text-xl text-ink lg:text-2xl">How would you like to pay?</h1>
          <p className="mt-1 text-sm text-subtle">
            Both are paid through the same secure window. Card details never touch our servers.
          </p>

          {/* One card per option, each carrying its own pair of numbers -- today and later. A radio
              mark rather than a bare highlight, because on the screen that spends money the customer
              should be able to see which one is armed without inferring it from a border colour. */}
          <div className="mt-5 flex flex-col gap-3">
            {Object.values(PAYMENT_MODES).map((option) => {
              const ppcod = option.id === "ppcod";
              const payable = ppcod ? advance : orderTotal;
              const active = paymentMode === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPaymentMode(option.id)}
                  aria-pressed={active}
                  className={`border p-4 text-left transition-colors lg:p-5 ${
                    active
                      ? "border-ink bg-surface ring-1 ring-ink"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        active ? "border-ink" : "border-line-2"
                      }`}
                    >
                      {active && <span className="size-2 rounded-full bg-action" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-base text-ink">{option.label}</span>
                        <span className="num shrink-0 text-base font-semibold text-ink">
                          ₹{formatPrice(payable)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm leading-snug text-subtle">
                        {option.blurb}
                      </span>

                      {ppcod && (
                        // The number that actually decides this: what they hand over at the door.
                        <span className="num mt-2 block border-t border-line pt-2 text-xs text-meta">
                          ₹{formatPrice(balanceDue)} due on delivery
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {paymentMode === "ppcod" && (
            <p className="mt-3 flex items-start gap-2.5 border border-line bg-paper p-3.5 text-xs leading-relaxed text-subtle">
              <Truck size={15} strokeWidth={1.6} className="mt-px shrink-0 text-meta" />
              <span>
                Keep <span className="num text-ink">₹{formatPrice(balanceDue)}</span> ready for the
                delivery crew — cash or UPI. Material is unloaded once the balance is settled.
              </span>
            </p>
          )}

          {/* ================= WHERE IT IS GOING ================= */}
          {shipTo && (
            <section className="mt-7 border border-line bg-surface p-4 lg:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                  <MapPin size={15} strokeWidth={1.6} className="text-subtle" />
                  Delivering to
                </h2>
                <Link
                  href="/checkout/shipping"
                  className="text-xs text-action-ink underline underline-offset-2"
                >
                  Change
                </Link>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-subtle">
                <span className="text-ink">
                  {[shipTo.firstName, shipTo.lastName].filter(Boolean).join(" ")}
                </span>
                <br />
                {[shipTo.address1, shipTo.address2, shipTo.city].filter(Boolean).join(", ")}
                <br />
                {shipTo.province} <span className="num">{shipTo.zip}</span>
                {shipTo.phone ? (
                  <>
                    {" · "}
                    <span className="num">{shipTo.phone}</span>
                  </>
                ) : null}
              </p>
            </section>
          )}

          {/* ================= WHY THIS IS SAFE ================= */}
          {/* Three claims, each one true and checkable. Trust on a payment page comes from saying
              what happens to the money, not from a wall of borrowed badges -- the checkout layout
              already refuses to draw logos this store has no right to display. */}
          {/* ONE LINE ON A PHONE, three tiles on a desktop. Stacked full-size these ran ~200px of a
              360px screen -- reassurance that pushes the thing it is reassuring you about off the
              fold is just a wall. The short labels carry the same three promises; the sentences are
              detail, and detail is what a phone can afford to drop. */}
          <ul className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border border-line bg-surface px-3.5 py-3 sm:mt-7 sm:grid sm:grid-cols-3 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
            {[
              [ShieldCheck, "Razorpay secured", "Razorpay handles the payment", "We never see or store your card."],
              [FileText, "GST invoice", "GST invoice by email", "Sent as soon as the order is confirmed."],
              [Headphones, "Real support", "A person, not a queue", "Order issues answered by our own team."],
            ].map(([Icon, short, title, line]) => (
              <li
                key={title}
                className="flex items-center gap-1.5 sm:block sm:border sm:border-line sm:bg-surface sm:p-3.5"
              >
                <Icon size={14} strokeWidth={1.6} className="shrink-0 text-subtle sm:size-4" />
                <p className="text-xs text-subtle sm:mt-2 sm:font-medium sm:text-ink">
                  <span className="sm:hidden">{short}</span>
                  <span className="max-sm:hidden">{title}</span>
                </p>
                <p className="mt-0.5 text-xs leading-snug text-meta max-sm:hidden">{line}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* ================= WHAT IT COSTS ================= */}
        <div className="lg:col-span-5">
          <div className="border border-line bg-surface p-5 lg:sticky lg:top-8">
            <h2 className="text-sm font-medium text-ink">
              Your order
              <span className="ml-1 font-normal text-subtle">
                ({totalQuantity} {totalQuantity === 1 ? "item" : "items"})
              </span>
            </h2>

            {/* Pictures, same as the shipping page. Confirming ₹30,000 against a list of truncated
                product titles is asking somebody to trust their own memory. */}
            <ul className="mt-4 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.lineId} className="flex gap-3">
                  <span className="relative block aspect-swatch w-14 shrink-0 overflow-hidden border border-line bg-paper">
                    {item.image && (
                      <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-xs leading-snug text-ink">{item.title}</span>
                    <span className="num mt-0.5 text-xs text-meta">
                      {item.quantity} × ₹{formatPrice(item.price)}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm text-ink">₹{formatPrice(item.total)}</span>
                </li>
              ))}
            </ul>

            <dl className="num mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
              <div className="flex items-baseline justify-between text-subtle">
                <dt>Subtotal</dt>
                <dd>₹{formatPrice(taxableBase)}</dd>
              </div>
              <div className="flex items-baseline justify-between text-subtle">
                <dt>GST (18%)</dt>
                <dd>₹{formatPrice(gstAmount)}</dd>
              </div>

              {/* Same line, same wording as the shipping page. The customer agreed to this number
                  one screen ago and it must still be here. */}
              <div className="flex items-baseline justify-between text-subtle">
                <dt>
                  Unloading
                  <span className="ml-1 text-xs text-meta">
                    ({deliveryOption === "doorstep" ? "doorstep" : "ground floor"})
                  </span>
                </dt>
                <dd>
                  {unloading.needsConfirmation
                    ? "To be confirmed"
                    : unloading.amount === 0
                      ? "Free"
                      : `₹${formatPrice(unloading.amount)}`}
                </dd>
              </div>

              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3 text-ink">
                <dt className="text-base">Order total</dt>
                <dd className="text-lg font-semibold">₹{formatPrice(orderTotal)}</dd>
              </div>

              {/* The split, shown only when there IS one. On a full payment these two lines would
                  say the same thing twice. */}
              {paymentMode === "ppcod" && (
                <>
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3 text-ink">
                    <dt>Paying now</dt>
                    <dd className="font-semibold">₹{formatPrice(payableNow)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between text-subtle">
                    <dt>On delivery</dt>
                    <dd>₹{formatPrice(balanceDue)}</dd>
                  </div>
                </>
              )}
            </dl>

            {error && (
              <p className="mt-4 border border-bad/30 bg-bad/5 p-3 text-sm text-bad">{error}</p>
            )}

            {/* The carry is priced from the delivery address. If it will not load we cannot show
                what this order costs, and the server would charge a number this page never said --
                which is the failure the whole unloading line exists to prevent. Say so, do not
                quietly bill the goods total. */}
            {deliveryOption === "doorstep" && shipToLoaded && !shipTo && (
              <p className="mt-4 border border-line bg-paper p-3 text-sm text-subtle">
                We could not load your delivery address, so the unloading charge cannot be shown.{" "}
                <Link href="/checkout/shipping" className="text-action-ink underline underline-offset-2">
                  Go back and choose it again
                </Link>
                .
              </p>
            )}

            <StickyCta
              note={
                paymentMode === "ppcod" ? (
                  <p className="num mt-2 text-center text-xs text-meta">
                    ₹{formatPrice(balanceDue)} due on delivery
                  </p>
                ) : null
              }
            >
              {/* The carry cannot be priced until the address (its floor, its lift) has loaded, and a
                  button that says one number while the server charges another is the whole bug this
                  page just fixed. A doorstep order waits the half second. */}
              <Button
                onClick={pay}
                disabled={
                  !sdkReady || paying || !cartId || (deliveryOption === "doorstep" && !shipTo)
                }
                className="w-full lg:mt-5"
              >
                {paying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Lock size={14} strokeWidth={1.75} />
                    Pay ₹{formatPrice(payableNow)}
                    {paymentMode === "ppcod" ? " now" : ""}
                  </>
                )}
              </Button>
            </StickyCta>

            {/* Named in words, not logos: these are payment methods Razorpay offers, which is a fact
                about our own integration rather than a brand mark we would be borrowing. */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {["UPI", "Cards", "Net banking", "Wallets"].map((method) => (
                <span
                  key={method}
                  className="border border-line px-2 py-1 text-[11px] text-meta"
                >
                  {method}
                </span>
              ))}
            </div>

            {/* Desktop only: on a phone the strip above already says Razorpay, and the checkout
                header says "Secure checkout" a scroll up. Three lockups for one fact is how a page
                starts protesting too much. */}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-meta max-lg:hidden">
              <Lock size={12} strokeWidth={1.6} />
              Encrypted and processed by Razorpay
            </p>
          </div>
        </div>
      </div>

      {/* Covers the window between a successful payment and the confirmation page. Without it the
          cart empties under the customer and they see a blank checkout for a beat, which is exactly
          the moment somebody hits refresh. */}
      {paying && paidRef.current && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-paper/95">
          <Loader2 className="size-6 animate-spin text-action" />
          <p className="text-sm text-ink">Confirming your order — do not close this page.</p>
        </div>
      )}
    </div>
  );
}

export default function PaymentPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-subtle" />
        </div>
      }
    >
      <PaymentInner />
    </Suspense>
  );
}
