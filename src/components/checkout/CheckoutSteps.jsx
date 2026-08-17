"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

/**
 * Cart → Address → Payment.
 *
 * The checkout layout used to argue against this, and it was right at the time: the store owned one
 * checkout page and handed off to Shopify for the rest, so a bar would have drawn two steps this app
 * could not highlight. It now owns all three, and on the page where somebody is about to send
 * ₹30,000 the question "how much more of this is there?" deserves an answer on screen.
 *
 * Renders nothing anywhere else, so the success and failure pages are unaffected.
 */
const STEPS = [
  { href: "/checkout/cart", label: "Cart" },
  { href: "/checkout/shipping", label: "Address" },
  { href: "/checkout/payment", label: "Payment" },
];

export default function CheckoutSteps() {
  const pathname = usePathname();
  const current = STEPS.findIndex((step) => pathname.startsWith(step.href));
  if (current < 0) return null;

  return (
    <ol className="flex items-center gap-2 text-xs sm:gap-3">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;

        return (
          <li key={step.href} className="flex items-center gap-2 sm:gap-3">
            <span
              className={`flex items-center gap-1.5 ${
                active ? "text-ink" : done ? "text-subtle" : "text-meta"
              }`}
            >
              <span
                className={`num flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : done
                      ? "border-good/40 bg-good/10 text-good"
                      : "border-line-2 text-meta"
                }`}
              >
                {done ? <Check size={11} strokeWidth={2.5} /> : i + 1}
              </span>
              {/* The labels go on a phone; the numbered dots still show how far along this is. */}
              <span className="max-sm:hidden">{step.label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span className={`h-px w-6 sm:w-10 ${done ? "bg-good/40" : "bg-line-2"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
