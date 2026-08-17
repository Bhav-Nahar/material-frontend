import assert from "node:assert/strict";
import test from "node:test";

// The module reads `window.sessionStorage`, so stand one up before importing it.
const store = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { readPlpState, savePlpState } = await import("./plpScroll.js");

const URL_KEY = "/collections/tiles?finish=Matte";

test("a position saved a moment ago comes back", () => {
  store.clear();
  savePlpState(URL_KEY, { scrollY: 4200, pages: 5 });
  assert.deepEqual(
    (({ scrollY, pages }) => ({ scrollY, pages }))(readPlpState(URL_KEY)),
    { scrollY: 4200, pages: 5 },
  );
});

test("a position saved yesterday does not -- a fresh visit must not be hijacked", () => {
  store.clear();
  store.set(`plp:${URL_KEY}:state`, JSON.stringify({
    scrollY: 4200,
    pages: 5,
    savedAt: Date.now() - 31 * 60 * 1000,
  }));
  assert.equal(readPlpState(URL_KEY), null);
});

test("no state, or junk in the slot, reads as no state rather than throwing", () => {
  store.clear();
  assert.equal(readPlpState(URL_KEY), null);
  store.set(`plp:${URL_KEY}:state`, "{not json");
  assert.equal(readPlpState(URL_KEY), null);
  // Written by an older build, before savedAt existed.
  store.set(`plp:${URL_KEY}:state`, JSON.stringify({ scrollY: 10, pages: 1 }));
  assert.equal(readPlpState(URL_KEY), null);
});

test("two filter sets of one collection keep two positions", () => {
  store.clear();
  savePlpState("/collections/tiles", { scrollY: 100, pages: 1 });
  savePlpState("/collections/tiles?finish=Matte", { scrollY: 900, pages: 4 });
  assert.equal(readPlpState("/collections/tiles").scrollY, 100);
  assert.equal(readPlpState("/collections/tiles?finish=Matte").scrollY, 900);
});
