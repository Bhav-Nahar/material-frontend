/**
 * Homepage FAQs.
 *
 * READ THIS BEFORE LAUNCH. The answers split into two kinds:
 *
 *   CONFIRMED -- true because something in this codebase or the store already says so: per-sq-ft
 *   pricing sold by the box (see mapProducts in lib/products.js), ₹99 samples, freight quoted
 *   before payment, Mumbai and MMR delivery (all three are in the announcement bar).
 *
 *   PLACEHOLDER -- a plausible policy nobody has confirmed. Breakage windows, return windows,
 *   lead times and what "installation support" actually includes are commitments, and a wrong one
 *   published on the homepage is a promise the shop has to honour or argue about. Each is marked
 *   below. Replace them with the real policy, or delete the question until there is one.
 *
 * Answers are PLAIN TEXT, not HTML. The jewelry build's version stores markup and renders it
 * through dangerouslySetInnerHTML; nothing here needs bold or paragraphs badly enough to earn that.
 */
export const HOME_FAQS = [
  {
    // CONFIRMED -- this is exactly how the site prices and how Shopify charges.
    question: "Why is the price per square foot when I pay by the box?",
    answer:
      "Tiles are compared per square foot and sold by the box, so we show both: the per-sq-ft rate to judge it against another tile, and the box price you actually pay. A box covers a fixed area, and we can only sell whole boxes.",
    // No link: /pages/pricing does not exist in Shopify (see data/footer.js) — restore when it does.
  },
  {
    // CONFIRMED -- trade-standard arithmetic, not a Material-specific promise.
    question: "How many boxes should I order?",
    answer:
      "Measure the area in square feet, divide by the coverage printed on the box, then add about 10% for cuts, corners and the odd breakage. Round up to whole boxes. Send us your measurements on WhatsApp and we will check the number before you order.",
  },
  {
    // CONFIRMED -- announcement bar: "₹99 samples, refunded against your order".
    question: "Can I see a sample before I order?",
    answer:
      "Yes. Samples are ₹99 each and the amount comes off your order when you buy. Screens lie about colour and nothing about a tile's finish survives a photograph, so for anything going on a large floor we would rather you held one first.",
    // No link: /pages/samples does not exist in Shopify (see data/footer.js) — restore when it does.
  },
  {
    // CONFIRMED -- announcement bar: Mumbai and MMR, freight quoted before you pay.
    question: "Where do you deliver, and what does freight cost?",
    answer:
      "Across Mumbai and the MMR. Freight depends on weight and floor, so it is calculated and shown to you at checkout before you pay rather than added afterwards.",
    link: { href: "/pages/delivery", text: "Delivery and freight" },
  },
  {
    // PLACEHOLDER -- confirm the real breakage window and evidence required.
    question: "What if something arrives broken?",
    answer:
      "Tiles travel badly and some breakage is normal, which is why the 10% overage matters. Check the boxes on delivery and photograph anything cracked before it is moved; we replace breakage reported with photos.",
    link: { href: "/pages/returns", text: "Returns and breakage" },
  },
  {
    // PLACEHOLDER -- confirm whether unopened boxes can be returned, and within how long.
    question: "Can I return boxes I did not use?",
    answer:
      "Unopened boxes in their original packaging can be returned. Opened boxes and cut tiles cannot, and made-to-order items are not returnable at all.",
    link: { href: "/pages/returns", text: "Returns and breakage" },
  },
  {
    // PLACEHOLDER -- confirm what this actually is: own fitters, a vetted list, or advice only.
    question: "Do you install as well?",
    answer:
      "We are a materials supplier, not a contractor, but we can put you in touch with fitters who work with these materials regularly and advise your own mason on adhesive, spacing and laying pattern.",
    // No link: /pages/installation does not exist in Shopify (see data/footer.js) — restore when it does.
  },
  {
    // PLACEHOLDER -- confirm real lead times for stock vs made-to-order.
    question: "How long will my order take?",
    answer:
      "Anything held in stock generally reaches you within a few days across Mumbai and the MMR. Made-to-order items take longer and are marked as such on the product itself.",
  },
];
