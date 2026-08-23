// The row lookup behind a signed-in wishlist REMOVAL. The one piece of logic here that can delete
// the wrong thing: the action carries a handle, the API deletes by productId, and the row that
// connects them only exists in the pre-reducer state.
//
// Run: node src/redux/wishlistSyncListener.test.mjs
import assert from "node:assert/strict";

// Inlined rather than imported: the module pulls in @/lib/api and sonner, neither of which resolves
// outside Next's bundler. The function is copied verbatim -- if it drifts, this test is worthless,
// so keep them together.
const rowFor = (wishlist = {}, payload) => {
  const handle = payload?.productHandle ?? payload;
  if (!handle) return null;
  return (
    [...(wishlist.items ?? []), ...(wishlist.guestItems ?? [])].find(
      (i) => i.productHandle === handle || i.productId === handle,
    ) ?? null
  );
};

const SERVER = { productId: "gid://shopify/Product/1", productHandle: "oak-plank", variantId: "v1" };
const GUEST = { productId: "sea-green", productHandle: "sea-green" };

// The signed-in case: found in `items`, and it carries the ids the DELETE needs.
assert.equal(rowFor({ items: [SERVER], guestItems: [] }, { productHandle: "oak-plank" }), SERVER);

// The guest-then-signed-in case: the row is only in guestItems and must still be found.
assert.equal(rowFor({ items: [], guestItems: [GUEST] }, { productHandle: "sea-green" }), GUEST);

// A bare id, which older call sites send instead of an object.
assert.equal(rowFor({ items: [SERVER] }, "gid://shopify/Product/1"), SERVER);

// NOT FOUND must be null, never a wrong row -- this is the assertion that matters. The caller skips
// the DELETE on null; anything else here would delete somebody's other saved product.
assert.equal(rowFor({ items: [SERVER], guestItems: [GUEST] }, { productHandle: "not-saved" }), null);
assert.equal(rowFor({}, { productHandle: "oak-plank" }), null);
assert.equal(rowFor({ items: [SERVER] }, undefined), null);
assert.equal(rowFor({ items: [SERVER] }, {}), null);

console.log("wishlistSyncListener: rowFor ok");
