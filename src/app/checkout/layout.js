import { Lock } from "lucide-react";

import Wordmark from "@/components/header/Wordmark";
import CheckoutSteps from "@/components/checkout/CheckoutSteps";

/**
 * CHECKOUT CHROME -- deliberately not the site's.
 *
 * /checkout/* sits OUTSIDE the (shop) route group, so it inherits the root layout and nothing else:
 * no nav, no mega-menu, no search, no five-column footer, no timed signup dialog (user,
 * 2026-08-15). Every one of those is a way out of the one page whose only job is to be paid on, and
 * the cart is where this store's customers arrive after working a calculator -- they are finished
 * deciding. The jewelry build's app/(checkout-flow) makes the same cut.
 *
 * WHAT REPLACES IT is one bar, and it is not zero on purpose. A page with no mark on it, asking for
 * ₹30,000, is the shape of a phishing page -- an unbranded checkout reads as less trustworthy than
 * no checkout. So: the wordmark, which is also the way back if someone changes their mind, and one
 * true sentence about who takes the payment.
 *
 * A STEP INDICATOR, now that there is something true to draw. This said "no step indicator" while
 * /checkout/cart handed off to Shopify's hosted checkout -- a bar would have drawn two steps the app
 * did not own. It owns all three today, so the bar is honest and it answers the question every
 * checkout gets asked: how much more of this is there?
 *
 * NO CHECKOUT FOOTER either. The jewelry build's carries trust badges and payment-network icons;
 * ours has no confirmed return window to badge and no payment logos it has the right to display
 * yet. An empty frame is worse than no frame -- add it when there is something true to put in it.
 */
export default function CheckoutLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-line bg-surface">
        <div className="container-main flex h-16 items-center justify-between gap-4 lg:h-20">
          <Wordmark href="/" />

          <CheckoutSteps />

          {/* "Secure checkout" and no more (user, 2026-08-15). It named Shopify, which is the
              store's plumbing rather than the customer's reassurance -- on the page where money
              changes hands the only name that should appear is the shop's own. Two words also fit a
              360px bar without the responsive hide the longer sentence needed. */}
          <p className="flex items-center gap-2 text-xs text-subtle">
            <Lock size={14} strokeWidth={1.5} className="shrink-0" />
            Secure checkout
          </p>
        </div>
      </header>

      {/* flex-1 so a near-empty cart still pushes the page to full height instead of leaving the
          background cut off halfway down a tall window. */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
