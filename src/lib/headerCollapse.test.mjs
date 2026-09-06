import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COLLAPSE_ABOVE,
  COLLAPSE_DELTA,
  EXPAND_AT_OR_BELOW,
  nextHideTop,
} from "./headerCollapse.js";

test("the hysteresis gap clears what scroll anchoring can move", () => {
  assert.ok(
    COLLAPSE_ABOVE - EXPAND_AT_OR_BELOW > COLLAPSE_DELTA,
    "a gap this narrow lets the header's own resize push scrollY back over the other threshold",
  );
});

test("collapses past the threshold, re-expands at the top", () => {
  assert.equal(nextHideTop(false, COLLAPSE_ABOVE + 1), true);
  assert.equal(nextHideTop(false, COLLAPSE_ABOVE), false);
  assert.equal(nextHideTop(true, EXPAND_AT_OR_BELOW), false);
  assert.equal(nextHideTop(true, EXPAND_AT_OR_BELOW + 1), true);
});

test("stays put in the band a single threshold used to strobe in", () => {
  // The measured cycle ran 83..124. Nothing in it may flip a header that is already settled.
  for (let y = EXPAND_AT_OR_BELOW + 1; y <= COLLAPSE_ABOVE; y++) {
    assert.equal(nextHideTop(true, y), true, `collapsed header re-expanded at ${y}`);
    assert.equal(nextHideTop(false, y), false, `expanded header collapsed at ${y}`);
  }
});

test("settles from every start, with anchoring feeding scrollY back", () => {
  // Scroll anchoring moves scrollY by the height the flip added or removed above the viewport.
  // That is the loop the single threshold could not escape, so drive it and insist on a fixed point.
  for (let start = 0; start <= 400; start++) {
    let hidden = false;
    let y = start;
    let flips = 0;

    for (let step = 0; step < 50; step++) {
      const next = nextHideTop(hidden, y);
      if (next === hidden) break;
      y += next ? -COLLAPSE_DELTA : COLLAPSE_DELTA;
      hidden = next;
      flips += 1;
    }

    assert.equal(nextHideTop(hidden, y), hidden, `never settled from scrollY ${start}`);
    assert.ok(flips <= 1, `flipped ${flips} times from scrollY ${start}`);
  }
});
