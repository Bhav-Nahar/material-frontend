import test from "node:test";
import assert from "node:assert";

import { gstBreakdown } from "./delivery-charges.js";

// The property the whole function exists for: whatever paise the inputs carry, the printed rows
// must sum to the printed total. A contractor checks this arithmetic on a ₹27,000 order.
test("Subtotal + GST − Discount always equals the rounded total", () => {
  const cases = [
    [27668, 25668], // flat coupon
    [27668.5, 26284.98], // percentage coupon leaving paise
    [1844.5, 1844.5], // no coupon, paise-bearing total
    [999, 999], // no coupon, whole rupees
    [0, 0], // empty cart
  ];
  for (const [subtotal, total] of cases) {
    const { taxableBase, gstAmount, savingShown } = gstBreakdown(subtotal, total);
    assert.strictEqual(
      taxableBase + gstAmount - savingShown,
      Math.round(total),
      `rows disagree with total for subtotal=${subtotal}, total=${total}`,
    );
  }
});

test("no discount row is invented", () => {
  // An old persisted snapshot has no subtotal; 0 − total must not print as a discount.
  assert.strictEqual(gstBreakdown(0, 27668).saving, 0);
  assert.strictEqual(gstBreakdown(27668, 27668).saving, 0);
});

test("GST is extracted from the pre-discount base, not the discounted total", () => {
  const { taxableBase, gstAmount } = gstBreakdown(11800, 9800);
  // 11800 incl. 18% GST → 10000 taxable + 1800 GST.
  assert.strictEqual(taxableBase, 10000);
  assert.strictEqual(gstAmount, 1800);
});
