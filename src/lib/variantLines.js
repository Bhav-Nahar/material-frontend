/**
 * The second line on a variant button -- the coverage, under the title. No price.
 *
 * TWO CUTS, both the same argument. The line printed the rate and the coverage unconditionally,
 * which is right for sizes and wrong for colourways: four buttons repeating "16 sq ft/box", and
 * once colours are priced alike, the headline price reprinted four times underneath it. A control
 * whose job is to show what separates the options should not be mostly a constant. So a field has
 * to earn its place by VARYING -- and then the rate came out altogether (user, 2026-09-05), because
 * a number that only ever shows up when it differs, on a catalogue that does not price colourways
 * apart, is a branch waiting for a case that does not arrive.
 *
 * WHAT THIS GIVES UP, so it is a decision rather than a surprise: on a product whose SIZES are
 * priced apart -- a 1200 x 200 plank against a 600 x 600 tile, which is normal -- clicking a size
 * now moves the headline price with nothing on the button to have warned you. Put the rate back
 * here, under the same variance test, the day the catalogue has such a product and it reads wrong.
 *
 * Pure and separate from the component so both halves of the variance rule can be asserted; the
 * uniform case is the one the catalogue actually hits and the one a browser cannot show us.
 */
export function variantLine(variants, v) {
  const varies = (read) => new Set(variants.map(read)).size > 1;

  // "" rather than a space, so the button closes up instead of reserving a blank row.
  return varies((x) => x.coverage) && v.coverage > 0
    ? `${v.coverage} sq ft/${v.packUnit}`
    : "";
}
