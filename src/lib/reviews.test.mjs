import { test } from "node:test";
import assert from "node:assert/strict";

import { groupRatings, safePictureUrls, summarize } from "./reviews.js";

/**
 * The average is the one number here that can be wrong without looking wrong. It is printed beside
 * the price, drawn as stars, and published to Google as an aggregateRating -- so a review that
 * should not count, counting, is a claim the shop cannot support.
 */
const review = (over = {}) => ({
  id: 1,
  rating: 5,
  published: true,
  hidden: false,
  reviewer: { name: "A" },
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

test("hidden and unpublished reviews are excluded from the count AND the average", () => {
  const { count, average } = summarize([
    review({ id: 1, rating: 5 }),
    review({ id: 2, rating: 1, hidden: true }),
    review({ id: 3, rating: 1, published: false }),
  ]);
  assert.equal(count, 1);
  assert.equal(average, 5);
});

test("average is rounded to one decimal, the granularity the stars and the schema use", () => {
  // 4 + 4 + 5 = 13 / 3 = 4.333…
  const { average } = summarize([review({ rating: 4 }), review({ rating: 4 }), review({ rating: 5 })]);
  assert.equal(average, 4.3);
});

test("no reviews is 0 and an empty list, never NaN", () => {
  for (const input of [[], null, undefined]) {
    const { count, average, reviews } = summarize(input);
    assert.equal(count, 0);
    assert.equal(average, 0);
    assert.deepEqual(reviews, []);
  }
});

test("junk ratings are dropped rather than poisoning the average", () => {
  const { count, average } = summarize([
    review({ rating: 5 }),
    review({ rating: 0 }),
    review({ rating: 6 }),
    review({ rating: 4.5 }),
    review({ rating: null }),
  ]);
  assert.equal(count, 1);
  assert.equal(average, 5);
});

test("distribution carries every star, including the ones nobody gave", () => {
  const { distribution } = summarize([review({ rating: 5 }), review({ rating: 5 }), review({ rating: 3 })]);
  assert.deepEqual(distribution, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 });
});

test("only judge.me's 'buyer' state earns the verified badge", () => {
  const [buyer, other] = summarize([
    review({ id: 1, verified: "buyer", created_at: "2026-08-02T00:00:00Z" }),
    review({ id: 2, verified: "unverified", created_at: "2026-08-01T00:00:00Z" }),
  ]).reviews;
  assert.equal(buyer.verified, true);
  assert.equal(other.verified, false);
});

test("newest first", () => {
  const { reviews } = summarize([
    review({ id: 1, created_at: "2026-01-01T00:00:00Z" }),
    review({ id: 2, created_at: "2026-08-01T00:00:00Z" }),
  ]);
  assert.deepEqual(reviews.map((r) => r.id), [2, 1]);
});

/* --------------------------------------------------------------- card ratings */

test("groupRatings keys by shopify id and excludes hidden/unpublished", () => {
  const out = groupRatings([
    review({ id: 1, rating: 5, product_external_id: 111 }),
    review({ id: 2, rating: 3, product_external_id: 111 }),
    review({ id: 3, rating: 1, product_external_id: 111, hidden: true }),
    review({ id: 4, rating: 1, product_external_id: 111, published: false }),
    review({ id: 5, rating: 4, product_external_id: 222 }),
  ]);
  assert.deepEqual(out, { 111: { count: 2, average: 4 }, 222: { count: 1, average: 4 } });
});

test("store reviews (external id 0 or missing) never land on a product", () => {
  const out = groupRatings([
    review({ id: 1, rating: 1, product_external_id: 0 }),
    review({ id: 2, rating: 1, product_external_id: null }),
    review({ id: 3, rating: 5, product_external_id: 111 }),
  ]);
  assert.deepEqual(out, { 111: { count: 1, average: 5 } });
});

test("groupRatings rounds the same way summarize does", () => {
  const ids = [4, 4, 5].map((r, i) => review({ id: i, rating: r, product_external_id: 111 }));
  assert.equal(groupRatings(ids)[111].average, summarize(ids).average);
});

test("groupRatings on nothing is an empty object, not a crash", () => {
  for (const input of [[], null, undefined]) assert.deepEqual(groupRatings(input), {});
});

/* ------------------------------------------------------- review photo allow-list */

test("only https cdn.shopify.com URLs survive", () => {
  assert.deepEqual(safePictureUrls(["https://cdn.shopify.com/s/files/1/a.jpg"]), [
    "https://cdn.shopify.com/s/files/1/a.jpg",
  ]);
});

test("the classic wrong ways to write this check are rejected", () => {
  const hostile = [
    "https://evil.example/cdn.shopify.com/x.jpg", // substring in the PATH — beats includes()
    "https://notcdn.shopify.com/x.jpg", // beats endsWith()
    "https://cdn.shopify.com.evil.example/x.jpg", // beats startsWith() on the host
    "https://evil.example/?u=cdn.shopify.com", // substring in the QUERY
    "http://cdn.shopify.com/x.jpg", // right host, plaintext
    "//cdn.shopify.com/x.jpg", // protocol-relative, unparseable
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "",
    null,
    42,
    { url: "https://cdn.shopify.com/x.jpg" },
  ];
  assert.deepEqual(safePictureUrls(hostile), []);
});

test("a hostile URL cannot ride along with a good one", () => {
  const out = safePictureUrls([
    "https://cdn.shopify.com/s/files/1/ok.jpg",
    "https://evil.example/x.jpg",
  ]);
  assert.deepEqual(out, ["https://cdn.shopify.com/s/files/1/ok.jpg"]);
});

test("capped at four, so a flood cannot ride in on one review", () => {
  const many = Array.from({ length: 20 }, (_, i) => `https://cdn.shopify.com/${i}.jpg`);
  assert.equal(safePictureUrls(many).length, 4);
});

test("a non-array is an empty list, not a crash", () => {
  for (const input of [null, undefined, "https://cdn.shopify.com/x.jpg", {}]) {
    assert.deepEqual(safePictureUrls(input), []);
  }
});
