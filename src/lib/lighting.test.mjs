import { test } from "node:test";
import assert from "node:assert/strict";

import {
  kelvinToRgb,
  channelGain,
  washColor,
  LIGHTING_PRESETS,
  ADAPTATION,
  REFERENCE_KELVIN,
} from "./lighting.js";

/**
 * This filter paints over the one thing the customer is buying -- the colour. A gain that drifts
 * the wrong way sells a beige tile as pink, so the direction and the no-op are both pinned.
 */

/** White is the identity for `multiply`, so "as photographed" must be exactly white. */
test("the reference temperature is an exact identity, so 'as photographed' really is", () => {
  assert.equal(washColor(REFERENCE_KELVIN), "rgb(255 255 255)");
});

test("warmer light adds red and removes blue; cooler does the reverse", () => {
  const [warmR, , warmB] = channelGain(2700);
  assert.ok(warmR > 1, `warm should gain red, got ${warmR}`);
  assert.ok(warmB < 1, `warm should lose blue, got ${warmB}`);

  const [coolR, , coolB] = channelGain(9000);
  assert.ok(coolR < 1, `cool should lose red, got ${coolR}`);
  assert.ok(coolB >= 1, `cool should not lose blue, got ${coolB}`);
});

test("green is pinned, so warming shifts the cast without dimming the picture", () => {
  for (const kelvin of [2200, 2700, 3500, 4000, 5000, 6500, 9000]) {
    const [, g] = channelGain(kelvin);
    assert.ok(Math.abs(g - 1) < 1e-9, `green drifted to ${g} at ${kelvin}K`);
  }
});

test("the cast moves monotonically, so no preset is warmer than a warmer one", () => {
  const reds = [2200, 2700, 3500, 4000, 5000, 6500, 9000].map(
    (k) => channelGain(k)[0],
  );
  for (let i = 1; i < reds.length; i++) {
    assert.ok(
      reds[i] < reds[i - 1],
      `red went up between step ${i - 1} and ${i}: ${reds[i - 1]} -> ${reds[i]}`,
    );
  }
});

/**
 * Adaptation strength is the difference between "creamy white tile" and "orange tile". It must
 * damp the cast without ever inverting it, and zero strength must be an exact no-op.
 */
test("adaptation damps the cast without reversing its direction", () => {
  const full = channelGain(3000, REFERENCE_KELVIN, 1);
  const damped = channelGain(3000, REFERENCE_KELVIN, ADAPTATION);

  assert.ok(damped[0] > 1, "damped warm still gains red");
  assert.ok(damped[0] < full[0], "damping should reduce the red gain");
  assert.ok(damped[2] < 1, "damped warm still loses blue");
  assert.ok(damped[2] > full[2], "damping should raise the blue back toward 1");
});

test("zero adaptation is an exact identity at any temperature", () => {
  for (const kelvin of [2000, 3000, 6500, 40000]) {
    assert.equal(
      washColor(kelvin, REFERENCE_KELVIN, 0),
      "rgb(255 255 255)",
      `${kelvin}K at zero strength`,
    );
  }
});

test("garbage temperatures clamp instead of blanking the image with NaN", () => {
  for (const bad of [0, -500, NaN, null, undefined, "hot", Infinity]) {
    const gain = channelGain(bad);
    assert.ok(
      gain.every((n) => Number.isFinite(n) && n > 0),
      `${String(bad)} produced ${JSON.stringify(gain)}`,
    );
  }
});

/**
 * `multiply` can only darken, so every channel has to land in 0-255 with at least one AT 255 --
 * a wash whose brightest channel is below 255 is dimming the photograph for no reason, and one
 * above 255 is not a colour.
 */
test("every wash is a legal colour that darkens as little as possible", () => {
  for (const kelvin of [2000, 3000, 4000, REFERENCE_KELVIN, 6500, 8000]) {
    const channels = washColor(kelvin)
      .match(/\d+/g)
      .map(Number);

    assert.equal(channels.length, 3, `${kelvin}K`);
    for (const c of channels) {
      assert.ok(c >= 0 && c <= 255, `${kelvin}K produced ${c}`);
    }
    assert.equal(Math.max(...channels), 255, `${kelvin}K needlessly dims the image`);
  }
});

/** Renormalising for multiply must not rotate the hue -- only the ratios carry the cast. */
test("the wash preserves the gain ratios it came from", () => {
  for (const kelvin of [2500, 3000, 7000]) {
    const gain = channelGain(kelvin);
    const wash = washColor(kelvin)
      .match(/\d+/g)
      .map(Number);

    // red:blue is the axis the whole effect lives on.
    const gainRatio = gain[0] / gain[2];
    const washRatio = wash[0] / wash[2];
    assert.ok(
      Math.abs(gainRatio - washRatio) < 0.01,
      `${kelvin}K: gain r:b ${gainRatio.toFixed(3)} became ${washRatio.toFixed(3)}`,
    );
  }
});

/**
 * The bug this pins: anchoring the reference at the coolest preset made every option either
 * neutral or warmer, so the "cool" end of the control did nothing at all. The presets must
 * BRACKET the reference or one half of the feature is decorative.
 */
test("the presets straddle the reference, so warm warms and cool cools", () => {
  const warmer = LIGHTING_PRESETS.filter((p) => p.kelvin < REFERENCE_KELVIN);
  const cooler = LIGHTING_PRESETS.filter((p) => p.kelvin > REFERENCE_KELVIN);

  assert.ok(warmer.length, "no preset is warmer than the reference");
  assert.ok(cooler.length, "no preset is cooler than the reference");

  // And each side must actually move the pixels, not just the number.
  for (const preset of [...warmer, ...cooler]) {
    assert.notEqual(
      washColor(preset.kelvin),
      washColor(REFERENCE_KELVIN),
      `${preset.id} renders identically to the reference`,
    );
  }
});

/**
 * The bar opens at the reference temperature, and a preset pill has to match it or the control
 * opens with nothing selected -- which reads as broken rather than as "untouched".
 */
test("a preset sits exactly on the reference, so one pill is lit on open", () => {
  const atReference = LIGHTING_PRESETS.filter((p) => p.kelvin === REFERENCE_KELVIN);
  assert.equal(atReference.length, 1, "expected exactly one preset at the reference");
});

test("kelvinToRgb stays inside the byte range it claims to return", () => {
  for (const kelvin of [1000, 1500, 2700, 4000, 6500, 12000, 40000, 99999]) {
    for (const channel of kelvinToRgb(kelvin)) {
      assert.ok(
        channel >= 0 && channel <= 255,
        `${kelvin}K produced ${channel}`,
      );
    }
  }
});
