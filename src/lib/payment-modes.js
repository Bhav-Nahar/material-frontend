/**
 * How much of the order is collected today.
 *
 * THE SERVER IS THE AUTHORITY. These numbers exist so the page can SHOW an amount before the
 * customer commits; the charge itself is computed again in the backend from the Shopify cart, and
 * nothing here travels in the request. If the two ever disagree, the backend wins and the customer
 * sees the difference on the Razorpay modal — which is why ADVANCE_PERCENT must be changed in both
 * places (routes/payment.js) or not at all.
 *
 * 20% is the house rule, carried over from the Lucira build's partial-COD.
 *
 * ponytail: confirm the percentage with operations before launch.
 */
export const ADVANCE_PERCENT = 20;

export const advanceFor = (total) => Math.max(1, Math.round((total * ADVANCE_PERCENT) / 100));

export const PAYMENT_MODES = {
  full: {
    id: "full",
    label: "Pay in full",
    blurb: "Nothing to pay on delivery.",
  },
  ppcod: {
    id: "ppcod",
    label: `Pay ${ADVANCE_PERCENT}% now`,
    blurb: "Balance collected at your door when the material arrives.",
  },
};
