import { test } from "node:test";
import assert from "node:assert/strict";

import { boxesForArea, areaForBoxes, toCardProduct } from "./product.js";

/**
 * The one piece of arithmetic on the PDP that can be wrong without looking wrong: a calculator
 * that under-orders sends a customer a box short of finishing their floor.
 *
 * The numbers are the real test product's -- 15.5 sq ft a box -- so these agree with
 * scripts/verify-cart.mjs, which proves the same sum against Shopify's own cart total.
 */
test("200 sq ft at 15.5 per box, +10% wastage, is 15 boxes", () => {
  assert.equal(boxesForArea(200, 15.5), 15);
});

test("always rounds up -- Shopify rejects a fractional quantity", () => {
  // Exactly one box of area still needs a second box once wastage is added.
  assert.equal(boxesForArea(15.5, 15.5), 2);
  assert.equal(boxesForArea(15.5, 15.5, 0), 1);
});

test("no wastage is honoured, not silently re-added", () => {
  assert.equal(boxesForArea(200, 15.5, 0), 13);
});

test("garbage in returns 0 rather than NaN or Infinity", () => {
  for (const [area, coverage] of [[0, 15.5], [-5, 15.5], [200, 0], [NaN, 15.5], [200, NaN]]) {
    assert.equal(boxesForArea(area, coverage), 0, `${area} / ${coverage}`);
  }
});

test("coverage reported back is what the boxes cover, to one decimal", () => {
  assert.equal(areaForBoxes(15, 15.5), 232.5);
  assert.equal(areaForBoxes(0, 15.5), 0);
  assert.equal(areaForBoxes(3, 14.4), 43.2);
});

/**
 * Editing the box count writes the covered area back into the area field (see AreaCalculator), so
 * that number is fed straight back into boxesForArea by the wastage toggle and by a size change.
 * It has to land on the same box count it came from, or the two controls push each other upward a
 * box at a time while the customer is only toggling a tickbox.
 */
test("area written back from a box count re-derives that same box count", () => {
  for (const coverage of [12.9, 14.4, 15.5]) {
    for (const boxes of [1, 3, 9, 25, 26, 999]) {
      // What AreaCalculator actually writes: the covered area, floored to a whole number.
      const written = Math.floor(areaForBoxes(boxes, coverage));
      assert.equal(
        boxesForArea(written, coverage, 0),
        boxes,
        `${boxes} boxes of ${coverage} -> ${written} sq ft`,
      );
    }
  }
});

/**
 * Flooring is safe, rounding is NOT, and the direction is load bearing rather than cosmetic: any
 * covered area whose remainder lands at .5 or above rounds UP past a box boundary and asks for one
 * more box than it came from. 5 boxes of 12.9 cover 64.5; rounded to 65 that re-derives as 6, and
 * that extra box is the creep the write-back exists to avoid.
 */
test("rounding the written-back area UP would inflate the box count", () => {
  const covered = areaForBoxes(5, 12.9); // 64.5
  assert.equal(boxesForArea(Math.floor(covered), 12.9, 0), 5);
  assert.equal(boxesForArea(Math.round(covered), 12.9, 0), 6);
});

/**
 * Below one square foot per box, flooring would round a real area down to a smaller box count (or
 * to zero). AreaCalculator re-derives before it commits to the whole number and keeps the decimal
 * when it does not survive the trip; this is the case that guard is for.
 */
test("a box covering under a square foot cannot be floored", () => {
  const covered = areaForBoxes(1, 0.5);
  assert.equal(covered, 0.5);
  assert.notEqual(boxesForArea(Math.floor(covered), 0.5, 0), 1);
  assert.equal(boxesForArea(covered, 0.5, 0), 1);
});

/**
 * With wastage on, the SAME written-back area must ask for more boxes, not the same number -- that
 * is what the tickbox promises. It must also settle: toggling twice returns the original count,
 * because the toggle only ever reads the area field and never rewrites it.
 */
test("wastage on a written-back area adds boxes, and toggling back returns them", () => {
  const coverage = 12.9;
  const written = areaForBoxes(26, coverage); // 335.4
  const withWastage = boxesForArea(written, coverage, 0.1);

  assert.ok(withWastage > 26, `expected more than 26 boxes, got ${withWastage}`);
  assert.equal(withWastage, 29);
  assert.equal(boxesForArea(written, coverage, 0), 26);
});

/**
 * The recently-viewed card must price exactly as mapProducts does, or the same product shows one
 * figure on a shelf and another in the trail: cheapest variant by PACK price, per-sq-ft leading
 * when coverage is set.
 */
test("toCardProduct prices the cheapest variant, per sq ft when it has coverage", () => {
  const card = toCardProduct({
    handle: "oak-plank",
    title: "Oak plank",
    category: "Tiles",
    tags: ["New"],
    inStock: true,
    media: [{ url: "a.jpg", altText: "Oak" }, { url: "b.jpg" }],
    variants: [
      { sku: "T2", price: 1900, comparePrice: 0, perSqFt: 122.5, perSqFtCompare: 0, coverage: 15.5, packUnit: "box" },
      { sku: "T1", price: 1844.5, comparePrice: 2100, perSqFt: 119, perSqFtCompare: 135.48, coverage: 15.5, packUnit: "box" },
    ],
  });

  assert.equal(card.sku, "T1");
  assert.equal(card.price, 119);
  assert.equal(card.unit, "sq ft");
  assert.equal(card.packPrice, 1844.5);
  assert.equal(card.fromPrice, true);
  assert.deepEqual(card.images, ["a.jpg", "b.jpg"]);
  assert.equal(card.alt, "Oak");
});

test("toCardProduct without coverage prices the pack and claims no unit", () => {
  const card = toCardProduct({
    handle: "wallpaper",
    title: "Wallpaper",
    category: null,
    tags: [],
    inStock: true,
    media: [],
    variants: [
      { sku: "W1", price: 3200, comparePrice: 0, perSqFt: 0, perSqFtCompare: 0, coverage: 0, packUnit: "roll" },
    ],
  });

  assert.equal(card.price, 3200);
  assert.equal(card.unit, null);
  assert.equal(card.packPrice, 0);
  assert.equal(card.fromPrice, false);

  assert.equal(toCardProduct({ media: [], variants: [] }), null);
});

/**
 * The related shelf's row maths. The failure worth catching is not an off-by-one in the count --
 * it is the small catalogue where flooring to whole rows removes the section entirely.
 */
import { wholeRows } from "./product.js";

const shelf = (n) => Array.from({ length: n }, (_, i) => ({ handle: `p${i}` }));

test("a full shelf is capped at the maximum", () => {
  assert.equal(wholeRows(shelf(40), 4, 16).length, 16);
  assert.equal(wholeRows(shelf(16), 4, 16).length, 16);
});

test("a ragged last row is dropped rather than left half empty", () => {
  assert.equal(wholeRows(shelf(15), 4, 16).length, 12);
  assert.equal(wholeRows(shelf(13), 4, 16).length, 12);
  assert.equal(wholeRows(shelf(7), 4, 16).length, 4);
});

test("a short catalogue keeps its cards instead of vanishing", () => {
  // Flooring would give zero rows here, and the section would not render at all.
  for (const n of [1, 2, 3]) assert.equal(wholeRows(shelf(n), 4, 16).length, n);
  assert.equal(wholeRows(shelf(0), 4, 16).length, 0);
});

test("whole rows already, at any column count", () => {
  assert.equal(wholeRows(shelf(9), 3, 16).length, 9);
  assert.equal(wholeRows(shelf(10), 2, 16).length, 10);
});

/**
 * The spec chips. These were a stored array until they became a function, so the thing worth
 * pinning is that a MISSING field produces no chip rather than a chip reading "undefined finish".
 */
import { specChips } from "./product.js";

const specsOf = (over) => ({
  look: "Marble",
  material: "Vitrified",
  finish: "Matte",
  slipRating: "R10",
  application: ["Living room", "Bedroom"],
  ...over,
});

test("every set field becomes one chip, tagged with the field it came from", () => {
  assert.deepEqual(specChips(specsOf()), [
    { label: "Marble", kind: "look" },
    { label: "Vitrified", kind: "material" },
    { label: "Matte finish", kind: "finish" },
    { label: "Slip R10", kind: "slip" },
  ]);
});

test("an unset field is absent, not an 'undefined finish' chip", () => {
  const sparse = specChips({ look: null, material: "Ceramic", finish: null, slipRating: null });
  assert.deepEqual(sparse, [{ label: "Ceramic", kind: "material" }]);
  for (const chip of sparse) assert.ok(!/undefined|null/.test(chip.label));
});

test("no specs at all is an empty row, not a crash", () => {
  assert.deepEqual(specChips(undefined), []);
  assert.deepEqual(specChips({}), []);
  assert.deepEqual(specChips({ application: [] }), []);
});

test("rooms are not chips -- ProductInsights shows them once, under Where it works", () => {
  assert.deepEqual(specChips({ application: ["Kitchen", "Bath", "Balcony"] }), []);
});

import { pickVariant, optionText, specRows } from "./product.js";

const V = (Size, Colour, extra = {}) => ({
  id: `${Size}/${Colour}`, title: `${Size} / ${Colour}`, options: { Size, Colour },
  thickness: 1, coverage: 0, coveragePerPack: 32, packUnit: "sheet", ...extra,
});

test("pickVariant swaps one option and keeps the other, falling back when the pair is not stocked", () => {
  const vs = [V("8x4", "Walnut"), V("8x4", "Ivory"), V("10x4", "Walnut")];
  assert.equal(pickVariant(vs, vs[0], "Colour", "Ivory").id, "8x4/Ivory");
  assert.equal(pickVariant(vs, vs[1], "Size", "10x4").id, "10x4/Walnut", "10x4 has no Ivory");
  assert.equal(pickVariant(vs, vs[0], "Colour", "Nope").id, "8x4/Walnut");
});

test("optionText names each option; a lone untitled variant says nothing", () => {
  const product = { options: [{ name: "Size" }, { name: "Colour" }] };
  assert.equal(optionText(product, V("8x4", "Walnut")), "Size: 8x4, Colour: Walnut");
  assert.equal(optionText({ options: [] }, { title: "Default Title", options: {} }), "");
});

test("specRows: look facts then fit facts, following the variant, empty rows dropped", () => {
  const product = {
    specs: {
      finish: "Textured", look: "Leather", material: null, application: ["TV Unit"], features: ["Light Weight"],
      flexibility: null, importantNote: [], colourFamily: [], slipRating: null,
    },
  };
  const rows = specRows(product, V("8x4", "Walnut"));
  assert.deepEqual(rows.map(([k]) => k), ["Colour", "Look", "Finish", "Size", "Thickness", "Coverage area"]);
  assert.equal(rows[0][1], "Walnut");
  assert.equal(rows.find(([k]) => k === "Coverage area")[1], "32 sq ft / sheet");
  // Shopify-admin products spell the option "Color".
  assert.equal(specRows(product, { ...V("8x4", "x"), options: { Size: "8x4", Color: "Ivory" } })[0][1], "Ivory");
});

import { mapProduct } from "./product.js";

test("images no colour claims are shared: shown with every colour, after its own", () => {
  const img = (n) => ({ url: `https://cdn/x/${n}.jpg?v=${n}`, altText: n });
  const gallery = (...ns) => ({ references: { nodes: ns.map((n) => ({ image: { ...img(n), url: `https://cdn/x/${n}.jpg?v=other` } })) } });
  const variant = (colour, g) => ({ id: colour, title: colour, selectedOptions: [{ name: "Colour", value: colour }], price: { amount: "1" }, gallery: g });
  const p = mapProduct({
    images: { nodes: ["a1", "a2", "b1", "later"].map(img) },
    options: [],
    variants: { nodes: [variant("A", gallery("a1", "a2")), variant("B", gallery("b1"))] },
  });
  const names = (v) => v.gallery.map((g) => g.altText);
  assert.deepEqual(names(p.variants[0]), ["a1", "a2", "later"], "own first, then the unclaimed one");
  assert.deepEqual(names(p.variants[1]), ["b1", "later"], "another colour's photos stay out");
});
