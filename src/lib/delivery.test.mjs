import { test } from "node:test";
import assert from "node:assert/strict";

import { checkPincode } from "./delivery.js";

/**
 * A serviceability check that answers "yes" for somewhere the shop cannot reach sends a customer
 * to checkout for an order that has to be cancelled, so the boundary is worth pinning down.
 */
test("real MMR pincodes are serviceable", () => {
  for (const pin of [
    "400001", // Fort, Mumbai
    "400104", // Mumbai suburb
    "400601", // Thane city
    "401202", // Vasai
    "410206", // Panvel
    "421201", // Dombivli
  ]) {
    assert.equal(checkPincode(pin).status, "serviceable", pin);
  }
});

test("pincodes outside the MMR are reported outside, not refused", () => {
  for (const pin of ["110001", "560001", "411001", "395003", "422001"]) {
    const result = checkPincode(pin);
    assert.equal(result.status, "outside", pin);
    // The pincode comes back so the copy can name it.
    assert.equal(result.pincode, pin);
  }
});

test("anything that is not a six-digit pincode is invalid, never serviceable", () => {
  for (const raw of ["", "  ", "4000", "4000012", "40000a", "abcdef", "000000", null, undefined, {}]) {
    assert.equal(checkPincode(raw).status, "invalid", JSON.stringify(raw));
  }
});

test("surrounding whitespace is forgiven -- customers paste pincodes", () => {
  assert.equal(checkPincode("  400001 ").status, "serviceable");
});
