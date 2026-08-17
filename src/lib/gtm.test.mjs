// node --test src/lib/gtm.test.mjs
//
// The one thing worth a check here: `gtmItem` is the single shape EVERY event carries, so a card
// product, a cart line and a PDP variant have to come out of it identical field-for-field. If they
// drift, every funnel report joins on nothing and nothing in the app breaks loudly enough to notice.

import assert from "node:assert/strict";
import test from "node:test";

import { gtmItem, gtmProductItem, gtmCheckout, getNumericId } from "./gtm.js";

const KEYS = [
  "item_id",
  "variant_id",
  "item_sku",
  "item_name",
  "item_brand",
  "item_category",
  "item_variant",
  "item_handle",
  "item_url",
  "item_image",
  "price",
  "offer_price",
  "currency",
  "quantity",
  "index",
];

// What mapProducts returns.
const card = {
  id: "gid://shopify/Product/771",
  variantId: "gid://shopify/ProductVariant/9001",
  handle: "carrara-subway",
  title: "Carrara Subway",
  category: "Tiles",
  sku: "TL-05295",
  price: 119,
  comparePrice: 212,
  images: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
};

// What /api/cart returns per line.
const line = {
  productId: "gid://shopify/Product/771",
  variantId: "gid://shopify/ProductVariant/9001",
  handle: "carrara-subway",
  title: "Carrara Subway",
  category: "Tiles",
  variantTitle: "600x600",
  sku: "TL-05295",
  image: "https://cdn/a.jpg",
  price: 1844.5,
  comparePrice: 3286,
  quantity: 15,
};

test("getNumericId strips the gid", () => {
  assert.equal(getNumericId("gid://shopify/ProductVariant/9001"), 9001);
  assert.equal(getNumericId(9001), 9001);
  assert.equal(getNumericId(null), 0);
});

test("every source yields the same keys, in the same shape", () => {
  const fromCard = gtmItem(card);
  const fromLine = gtmItem(line);
  const fromPdp = gtmProductItem(
    { id: card.id, handle: card.handle, title: card.title, category: card.category, media: [{ url: "https://cdn/a.jpg" }] },
    { id: card.variantId, title: "600x600", sku: card.sku, price: 1844.5, comparePrice: 3286, perSqFt: 119, perSqFtCompare: 212 },
    3,
  );

  for (const item of [fromCard, fromLine, fromPdp]) {
    assert.deepEqual(Object.keys(item).sort(), [...KEYS].sort());
  }

  // The join keys agree across all three -- this is the whole point of the file.
  for (const item of [fromCard, fromLine, fromPdp]) {
    assert.equal(item.item_id, "771");
    assert.equal(item.variant_id, "9001");
    assert.equal(item.item_sku, "TL-05295");
    assert.equal(item.item_name, "Carrara Subway");
  }
});

test("price is what we sell for, offer_price is the higher was-price", () => {
  const item = gtmItem(card);
  assert.equal(item.price, 119);
  assert.equal(item.offer_price, 212);
  assert.ok(item.offer_price >= item.price);
});

test("no compare-at means offer_price falls back to price, never 0", () => {
  const item = gtmItem({ ...card, comparePrice: 0 });
  assert.equal(item.offer_price, 119);
});

test("a compare-at BELOW the selling price cannot invert the pair", () => {
  const item = gtmItem({ ...card, comparePrice: 50 });
  assert.equal(item.offer_price, 119);
});

test("item_id falls back to the handle rather than reporting 0", () => {
  assert.equal(gtmItem({ ...card, id: null }).item_id, "carrara-subway");
});

test("index is 1-based", () => {
  assert.equal(gtmItem(card, 0).index, 1);
  assert.equal(gtmItem(card, 7).index, 8);
});

test("the PDP prices per sq ft when the variant carries coverage", () => {
  const perSqFt = gtmProductItem({ handle: "x", title: "X" }, { price: 1844.5, comparePrice: 3286, perSqFt: 119, perSqFtCompare: 212 });
  assert.equal(perSqFt.price, 119);
  assert.equal(perSqFt.offer_price, 212);

  const perPack = gtmProductItem({ handle: "x", title: "X" }, { price: 1844.5, comparePrice: 3286, perSqFt: 0 });
  assert.equal(perPack.price, 1844.5);
  assert.equal(perPack.offer_price, 3286);
});

test("gtmCheckout totals the lines it was given and keeps extra fields", () => {
  const payload = gtmCheckout({
    items: [line, { ...line, quantity: 2 }],
    value: 30000.005,
    coupon: null,
    payment_type: "Razorpay",
  });
  assert.equal(payload.total_quantity, 17);
  assert.equal(payload.total_product, 2);
  assert.equal(payload.coupon, "NA"); // never null -- a container variable reading it gets a string
  assert.equal(payload.value, 30000.01); // rounded to paise
  assert.equal(payload.currency, "INR");
  assert.equal(payload.payment_type, "Razorpay");
  assert.equal(payload.items[0].index, 1);
  assert.equal(payload.items[1].index, 2);
});
