import { test } from "node:test";
import assert from "node:assert/strict";

import { nextScrollState, DEAD_ZONE } from "./scrollDirection.js";

const VIEW = 800;
const at = (y, last, shown = false) => nextScrollState({ y, last, shown, viewportH: VIEW });

test("hidden inside the first screen, whichever way we are moving", () => {
  assert.equal(at(0, 500, true).shown, false);
  assert.equal(at(VIEW, 2000, true).shown, false);
  assert.equal(at(400, 900, true).shown, false);
});

test("shows on the way up, hides on the way down", () => {
  assert.equal(at(2000, 2400).shown, true);
  assert.equal(at(2400, 2000, true).shown, false);
});

test("a wobble smaller than the dead zone changes nothing", () => {
  // The rubber-band and trackpad momentum both emit these inside a downward scroll.
  const shown = at(2000 - (DEAD_ZONE - 1), 2000, false);
  assert.equal(shown.shown, false, "a 5px bounce must not flash the button on");
  assert.equal(shown.last, 2000, "and must not move the reference, or it ratchets");
});

test("a slow drag accumulates instead of being averaged away", () => {
  // 3px a frame upward: every step is under the dead zone, but they must add up.
  let s = { shown: false, last: 3000 };
  for (let i = 1; i <= 4; i++) {
    s = nextScrollState({ y: 3000 - i * 3, last: s.last, shown: s.shown, viewportH: VIEW });
  }
  assert.equal(s.shown, true, "12px of upward travel is a direction, in any number of frames");
});

test("reversing direction flips it back", () => {
  let s = at(2000, 2400);
  assert.equal(s.shown, true);
  s = nextScrollState({ y: 2600, last: s.last, shown: s.shown, viewportH: VIEW });
  assert.equal(s.shown, false);
});
