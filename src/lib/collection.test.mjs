// node --test src/lib/collection.test.mjs
//
// The URL is the collection page's whole filter state, so this covers the one translation that can
// be wrong without anything looking broken: a dropped or malformed filter silently returns MORE
// products than the shopper asked for, which reads as "the filter did nothing".
import assert from "node:assert/strict";
import test from "node:test";
import { readFilters, cleanFacet } from "./collection.js";

test("each Shopify filter id maps to the input Shopify would have handed back", () => {
  const { filters, unresolved } = readFilters(
    "filter.v.availability=In stock" +
      "&filter.p.product_type=Floor tiles" +
      "&filter.p.vendor=Kajaria" +
      "&filter.p.tag=anti-skid" +
      "&filter.v.option.Size=600x600" +
      "&filter.p.m.custom.look=Marble" +
      "&filter.v.m.spec.finish=Matte",
  );

  assert.deepEqual(filters, [
    { available: true },
    { productType: "Floor tiles" },
    { productVendor: "Kajaria" },
    { tag: "anti-skid" },
    { variantOption: { name: "Size", value: "600x600" } },
    { productMetafield: { namespace: "custom", key: "look", value: "Marble" } },
    { variantMetafield: { namespace: "spec", key: "finish", value: "Matte" } },
  ]);
  assert.deepEqual(unresolved, []);
});

test("several values of one facet each become their own input, so Shopify ORs them", () => {
  const { filters } = readFilters("filter.p.m.custom.look=Marble&filter.p.m.custom.look=Cement");
  assert.equal(filters.length, 2);
  assert.equal(filters[1].productMetafield.value, "Cement");
});

test("sort and cursor are not filters, and an unknown param is never guessed at", () => {
  const { filters, unresolved } = readFilters("sort=price-high&cursor=abc&q=marble&look=marble");
  assert.deepEqual(filters, []);
  // Held back for name-matching against the collection's own facets, not passed to Shopify.
  assert.deepEqual(unresolved, [["look", "marble"]]);
});

test("only the end of the price range that was actually set is sent", () => {
  assert.deepEqual(readFilters("price.gte=500").filters, [{ price: { min: 500 } }]);
  assert.deepEqual(readFilters("price.lte=2000").filters, [{ price: { max: 2000 } }]);
  assert.deepEqual(readFilters("price.gte=500&price.lte=2000").filters, [
    { price: { min: 500, max: 2000 } },
  ]);
  assert.deepEqual(readFilters("").filters, []);
});

test("a facet that cannot narrow anything is dropped rather than rendered", () => {
  const oneOption = {
    id: "filter.p.vendor",
    label: "Brand",
    type: "LIST",
    values: [
      { id: "a", label: "Kajaria", count: 12 },
      { id: "b", label: "Somany", count: 0 },
    ],
  };
  assert.equal(cleanFacet(oneOption), null);

  const priced = {
    id: "filter.v.price",
    label: "Price",
    type: "PRICE_RANGE",
    values: [{ id: "filter.v.price", input: '{"price":{"min":0,"max":1844.5}}' }],
  };
  assert.deepEqual(cleanFacet(priced), {
    id: "filter.v.price",
    label: "Price",
    type: "PRICE_RANGE",
    min: 0,
    max: 1844.5,
  });

  // Everything free: a slider from 0 to 0 is a control that cannot move.
  const freeEverything = {
    ...priced,
    values: [{ id: "filter.v.price", input: '{"price":{"min":0,"max":0}}' }],
  };
  assert.equal(cleanFacet(freeEverything), null);
});
