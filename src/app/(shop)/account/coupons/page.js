"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { ArrowRight, Check, Copy, Loader2 } from "lucide-react";

import { fetchCustomerCoupons } from "@/lib/api";
import { formatPrice } from "@/utils/formatPrice";

/**
 * Coupons won from the signup scratch card.
 *
 * EVERY FIGURE COMES FROM SHOPIFY -- the amount, the minimum, whether the discount is still active.
 * Nothing is duplicated into this app, so editing a discount in the Shopify admin changes what this
 * page says, and the page can never promise terms the checkout will refuse. Same reason the cart
 * asks Shopify whether a code applies rather than keeping a table of its own.
 *
 * SPENT CODES STAY VISIBLE, greyed, with the order they went on. Hiding them looks like the coupon
 * was lost, which is a support conversation; showing "used on #1003" answers it before it starts.
 */
export default function CouponsPage() {
  const accessToken = useSelector((state) => state.user.accessToken);

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCustomerCoupons(accessToken)
      .then((data) => !cancelled && setCoupons(data?.coupons || []))
      .catch((err) => !cancelled && setError(err?.message || "Could not load your coupons"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const copy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-subtle" />
      </div>
    );
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;

  if (coupons.length === 0) {
    return (
      <div className="max-w-md">
        <p className="text-sm text-subtle">
          No coupons yet. New customers get a scratch card worth ₹250–₹750 off their first order.
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
    <ul className="grid gap-4 sm:grid-cols-2">
      {coupons.map((coupon) => {
        const spent = coupon.used || !coupon.active;

        return (
          <li
            key={coupon.code}
            className={`flex flex-col border p-4 lg:p-5 ${
              spent ? "border-line bg-paper" : "border-line-2 bg-surface"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p
                className={`font-display text-2xl leading-none ${spent ? "text-meta" : "text-ink"}`}
              >
                {coupon.amount ? `₹${formatPrice(coupon.amount)} OFF` : "Discount"}
              </p>
              {spent && (
                <span className="shrink-0 text-xs text-meta">
                  {coupon.used ? "Used" : "Expired"}
                </span>
              )}
            </div>

            {coupon.minimumSubtotal ? (
              <p className="num mt-1.5 text-xs text-subtle">
                On orders over ₹{formatPrice(coupon.minimumSubtotal)}
              </p>
            ) : null}

            {/* The code itself is the point of the page, so it is the one thing that can be tapped.
                A dashed border is the usual "this is a coupon" cue and reads as copyable. */}
            <button
              type="button"
              onClick={() => copy(coupon.code)}
              disabled={spent}
              className={`num mt-4 flex items-center justify-center gap-2 border border-dashed py-2.5 text-sm transition-colors ${
                spent
                  ? "cursor-default border-line text-meta line-through"
                  : "border-line-2 text-ink hover:border-ink"
              }`}
            >
              {coupon.code}
              {!spent &&
                (copied === coupon.code ? (
                  <Check className="size-3.5 text-good" />
                ) : (
                  <Copy className="size-3.5 text-subtle" />
                ))}
            </button>

            <p className="mt-3 text-xs text-meta">
              {coupon.used
                ? `Used on order ${coupon.usedOnOrder ?? ""}`.trim()
                : !coupon.active
                  ? "No longer available"
                  : "Apply it in your cart at checkout."}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
