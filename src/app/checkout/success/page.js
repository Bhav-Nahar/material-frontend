"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Package } from "lucide-react";

import { GTM_PURCHASE_KEY, pushPurchase } from "@/lib/gtm";

function SuccessInner() {
  const orderName = useSearchParams().get("order");

  /**
   * purchase, from the payload the payment page wrote before opening Razorpay -- the cart it
   * describes no longer exists by the time this renders.
   *
   * REMOVED BEFORE IT IS PUSHED, not after. A customer refreshing their receipt, or reaching it
   * again from history, must not report a second order; clearing first means even a throw inside
   * the push cannot leave the payload behind to fire twice.
   */
  useEffect(() => {
    let payload = null;
    try {
      const raw = window.localStorage.getItem(GTM_PURCHASE_KEY);
      if (!raw) return;
      window.localStorage.removeItem(GTM_PURCHASE_KEY);
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload) pushPurchase(payload);
  }, []);

  return (
    <div className="container-main flex min-h-[60vh] items-center justify-center py-12">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-good/10 text-good">
          <Check size={24} strokeWidth={2} />
        </span>

        <h1 className="mt-5 font-display text-2xl text-ink">Order confirmed</h1>
        {orderName && (
          <p className="num mt-1.5 text-sm text-subtle">
            Your order <span className="text-ink">{orderName}</span>
          </p>
        )}

        {/* What actually happens next, not a generic thank-you. Freight on a materials order is a
            real conversation, so say that rather than implying it is already on a van. */}
        <p className="mt-4 text-sm leading-relaxed text-subtle">
          We&apos;ve emailed your confirmation. Our team will call to confirm the delivery slot and
          unloading before dispatch.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/account/orders"
            className="inline-flex items-center justify-center gap-2 bg-action px-6 py-3.5 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90"
          >
            <Package size={15} strokeWidth={1.75} />
            View my orders
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center border border-line px-6 py-3.5 text-xs uppercase tracking-wide text-ink transition-colors hover:bg-paper"
          >
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SuccessInner />
    </Suspense>
  );
}
