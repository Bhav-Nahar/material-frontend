import { test } from "node:test";
import assert from "node:assert/strict";

import { variantLine } from "./variantLines.js";

const tile = (over) => ({ perSqFt: 86, price: 1376, coverage: 16, packUnit: "box", ...over });

test("colourways carry no second line at all", () => {
  const colours = [tile(), tile(), tile(), tile()];
  for (const v of colours) assert.equal(variantLine(colours, v), "");
});

test("sizes show the coverage they disagree about", () => {
  const sizes = [tile({ coverage: 16 }), tile({ coverage: 10 })];
  assert.equal(variantLine(sizes, sizes[0]), "16 sq ft/box");
  assert.equal(variantLine(sizes, sizes[1]), "10 sq ft/box");
});

test("no price, however far the variants are apart on it", () => {
  const priced = [tile({ perSqFt: 125 }), tile({ perSqFt: 86 })];
  for (const v of priced) assert.equal(variantLine(priced, v), "");

  const packs = [tile({ perSqFt: 0, price: 1376 }), tile({ perSqFt: 0, price: 990 })];
  for (const v of packs) assert.equal(variantLine(packs, v), "");
});

test("a product with no coverage figure shows nothing rather than 'undefined'", () => {
  const packs = [tile({ coverage: 0 }), tile({ coverage: 10 })];
  assert.equal(variantLine(packs, packs[0]), "");
  assert.equal(variantLine(packs, packs[1]), "10 sq ft/box");
});
