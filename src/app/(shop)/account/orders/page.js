"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSelector } from "react-redux";
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react";

import { fetchCustomerOrders } from "@/lib/api";
import { formatPrice } from "@/utils/formatPrice";

// Shopify's statuses are SCREAMING_CASE and mix two different questions -- has it been paid, and has
// it shipped. One human label per order, payment first because that is what a customer chases.
const STATUS = {
  REFUNDED: { label: "Refunded", tone: "text-subtle" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "text-subtle" },
  PENDING: { label: "Payment pending", tone: "text-warn" },
  VOIDED: { label: "Cancelled", tone: "text-bad" },
};

const FULFILMENT = {
  FULFILLED: { label: "Delivered", tone: "text-good" },
  IN_PROGRESS: { label: "On the way", tone: "text-ink" },
  PARTIALLY_FULFILLED: { label: "Partly shipped", tone: "text-ink" },
  UNFULFILLED: { label: "Preparing", tone: "text-subtle" },
};

const statusFor = (order) =>
  STATUS[order.financialStatus] ||
  FULFILMENT[order.fulfillmentStatus] || { label: "Confirmed", tone: "text-subtle" };

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function OrdersPage() {
  const accessToken = useSelector((state) => state.user.accessToken);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCustomerOrders(accessToken)
      .then((data) => !cancelled && setOrders(data?.orders || []))
      .catch((err) => !cancelled && setError(err?.message || "Could not load your orders"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-subtle" />
      </div>
    );
  }

  if (error) return <p className="text-sm text-bad">{error}</p>;

  if (orders.length === 0) {
    return (
      <div className="max-w-md">
                <p className="mt-3 text-sm text-subtle">
          No orders yet. Everything you buy will show up here with its delivery status.
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
    <div>
      <ul className="mt-5 flex flex-col gap-4">
        {orders.map((order) => {
          const status = statusFor(order);
          const items = order.lineItems?.nodes || [];

          return (
            <li key={order.id} className="border border-line bg-surface p-4 lg:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="num text-sm font-semibold text-ink">{order.name}</p>
                  <p className="num mt-0.5 text-xs text-meta">{formatDate(order.processedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-semibold text-ink">
                    ₹{formatPrice(Number(order.currentTotalPrice?.amount || 0))}
                  </p>
                  <p className={`mt-0.5 text-xs ${status.tone}`}>{status.label}</p>
                </div>
              </div>

              {items.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <span className="relative block aspect-swatch w-12 shrink-0 overflow-hidden border border-line bg-paper">
                        {item.variant?.image?.url && (
                          <Image
                            src={item.variant.image.url}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="text-xs text-subtle">
                        <span className="line-clamp-1 text-ink">{item.title}</span>
                        <span className="num">× {item.quantity}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* statusUrl is Shopify's own tracking page -- it carries the live courier status and
                  needs no page of ours to maintain. */}
              {order.statusUrl && (
                <a
                  href={order.statusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-action-ink underline underline-offset-2"
                >
                  Track this order
                  <ExternalLink size={12} strokeWidth={1.75} />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
