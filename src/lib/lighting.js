/**
 * "How will this look under my lights?" -- the question every tile and laminate shopper actually
 * asks, and the one a single studio photograph cannot answer. A warm 2700K bulb pulls a grey tile
 * beige; 6500K daylight pulls the same tile blue. People order a sample, wait a week, and discover
 * this in their own hallway.
 *
 * WHAT THIS IS NOT: a render. We do not relight the photograph -- there is no normal map, no
 * material model, no idea where the lamp is. This applies the WHITE BALANCE SHIFT a camera would
 * record under that illuminant, which is the part of the effect that survives on a flat swatch and
 * is honest to compute. It moves the colour cast, not the shadows.
 *
 * HOW: a per-channel gain, which is exactly what white balance is. It ships as a `multiply` blend
 * over the photograph (see `washColor`) -- no canvas, no WebGL, no library, no per-pixel JS, and
 * composited on the GPU, so a mosaic of eight photographs re-tints in one frame.
 *
 * Two approaches were tried and rejected. CSS's own `sepia()`/`hue-rotate()` stack (which is what
 * Material Depot ships) cannot scale channels independently, and its hue rotation drags saturated
 * colours around the wheel -- a terracotta tile went pink on the way to "warm". An SVG
 * `feColorMatrix` gets the maths exactly right but `filter: url()` is rasterised on the CPU on
 * mobile and is a known scroll-jank trap.
 *
 * The scale is Kelvin because that is the number printed on the bulb box the customer is holding.
 */

/**
 * Planckian locus approximation (Tanner Helland's fit of Mitchell Charity's blackbody table),
 * valid 1000K-40000K to within a few units per channel -- far tighter than the difference anyone
 * can see on a photograph of a floor. The exact fit matters less than its MONOTONICITY: red must
 * fall and blue must rise across the whole range, or the slider would reverse somewhere in the
 * middle of it.
 *
 * The floor is 2000K, not the fit's own 1000K, because the curve genuinely reaches ZERO blue at or below
 * 1900K -- physically right (a candle emits almost no blue) and useless here: it makes the blue
 * gain 0, which strips the channel out of the photograph entirely rather than tinting it. No bulb
 * sold in a hardware shop is that warm; the warmest preset is 2700K. Clamping here keeps every
 * gain positive for any input, including the garbage ones.
 */
const MIN_KELVIN = 2000;
const MAX_KELVIN = 40000;

export function kelvinToRgb(kelvin) {
  // Clamp before dividing: the fit's logarithms are undefined at or below zero, and a caller
  // passing 0 or NaN should get a usable colour rather than propagate it into every pixel.
  const t =
    Math.min(MAX_KELVIN, Math.max(MIN_KELVIN, Number(kelvin) || REFERENCE_KELVIN)) / 100;

  const red =
    t <= 66 ? 255 : clamp255(329.698727446 * Math.pow(t - 60, -0.1332047592));

  const green =
    t <= 66
      ? clamp255(99.4708025861 * Math.log(t) - 161.1195681661)
      : clamp255(288.1221695283 * Math.pow(t - 60, -0.0755148492));

  const blue =
    t >= 66
      ? 255
      : t <= 19
        ? 0
        : clamp255(138.5177312231 * Math.log(t - 10) - 305.0447927307);

  return [red, green, blue];
}

const clamp255 = (v) => Math.min(255, Math.max(0, v));

/**
 * The illuminant the photography is assumed to have been shot under, and therefore the temperature
 * at which this filter is a no-op.
 *
 * 5000K, the MIDDLE preset -- not 6500K. Anchoring on daylight was the first attempt and is a trap:
 * it makes the coolest option the untouched photograph, so two of the three choices warm the image
 * and NOTHING ever cools it. A shopper with 6500K LED panels in a kitchen would click "Daylight",
 * see no change at all, and reasonably conclude the feature is broken. Sitting the reference in the
 * middle means warm casts yellow, cool casts blue, and each is visibly a move from the other.
 *
 * 5000K is also the right guess on the merits: studio product photography lights to roughly D50-D55,
 * not D65. Material Depot anchors its own neutral at 5000K for the same reason.
 */
export const REFERENCE_KELVIN = 5000;

/**
 * How much of the physical shift to actually apply, 0-1.
 *
 * The full colorimetric gain is WRONG on screen, and this is the whole subtlety of the feature.
 * Applying 5000K->3000K at full strength turns a white tile amber -- which is what a camera locked
 * to daylight would record, and is not what a person in that room sees. Human vision chromatically
 * adapts: standing under a warm bulb, your eye renormalises and a white tile still looks white,
 * just faintly creamy. Rendering the camera's answer therefore misrepresents the product in the
 * customer's favour-free direction -- it makes an alabaster tile look like a terracotta one.
 *
 * 0.35 is a partial von Kries adaptation: enough that the cast is unmistakable when you toggle,
 * little enough that the material still reads as its own colour. It was picked by eye against a
 * white tile, which is the worst case -- a saturated colour hides a cast far more forgivingly.
 *
 * ponytail: one global constant. A gloss tile genuinely takes more cast than a matte one (the
 * `finish` metafield is right there in `product.specs`), but that is a second variable to tune with
 * no photography to validate it against. Revisit if shoppers say the preview undersells gloss.
 */
export const ADAPTATION = 0.35;

/**
 * Per-channel gain taking a photograph shot at `reference` to how it would read at `kelvin`.
 *
 * Normalised on GREEN, which carries most of perceived luminance, so the cast moves while the
 * picture's brightness stays put. Warm therefore pushes red above 1 -- correct, since a white wall
 * under a tungsten bulb really is brighter in red than the daylight photograph of it. `washColor`
 * renormalises afterwards for what `multiply` can express; the ratios it needs are set here.
 */
export function channelGain(kelvin, reference = REFERENCE_KELVIN, strength = ADAPTATION) {
  const target = kelvinToRgb(kelvin);
  const base = kelvinToRgb(reference);

  return target.map((channel, i) => {
    const ref = base[i];
    // A reference channel of zero cannot be divided into. It only happens below 1900K, which no
    // preset here reaches, but a caller passing a candle-flame temperature should get a flat 1
    // rather than an Infinity that blanks the image.
    if (!ref) return 1;
    const full = (channel / ref) * (base[1] / target[1] || 1);
    // Interpolated GEOMETRICALLY (toward 1), not linearly (toward 0), because these are gains:
    // halving the strength of a 2x gain has to give 1.41x, not 1.5x, or the neutral point drifts
    // and a strength of 0 stops being an exact identity.
    return Math.pow(full, strength);
  });
}

/**
 * The same per-channel gain, expressed as a colour to MULTIPLY the photograph by.
 *
 * Why not the obvious `feColorMatrix`: an SVG `filter: url(#id)` is rasterised on the CPU on most
 * mobile browsers and is a well-known scroll-jank and repaint trap (Safari especially). A solid
 * `<div>` with `mix-blend-mode: multiply` is composited on the GPU, and multiplying by a colour IS
 * a per-channel gain -- exactly the operation wanted -- so the cheap primitive and the correct
 * maths turn out to be the same thing.
 *
 * The one concession multiply forces: it can only ever darken, so the gains are renormalised by
 * their LARGEST channel to bring them all to <= 1. Warm light therefore comes out very slightly
 * dimmer overall rather than brighter in red. That is a fair trade and arguably truer to a room lit
 * by one yellow bulb; the alternative is a `brightness()` filter on top to win the fraction back,
 * which puts a second compositing pass on every image to correct something nobody can see.
 *
 * The HUE is unaffected by that renormalisation -- the ratios between channels are what carry the
 * cast, and dividing all three by the same number leaves them untouched.
 */
export function washColor(kelvin, reference = REFERENCE_KELVIN, strength = ADAPTATION) {
  const gain = channelGain(kelvin, reference, strength);
  const peak = Math.max(...gain) || 1;
  const [r, g, b] = gain.map((c) => Math.round((c / peak) * 255));
  return `rgb(${r} ${g} ${b})`;
}

/**
 * The bulbs sold in Indian hardware shops, in the words printed on their boxes. Three, not a
 * continuous slider: nobody knows their hallway is 3400K, and a slider invites fiddling with a
 * number that is a guess anyway. Three named choices are the decision the customer can actually
 * make.
 *
 * The slider below covers everything between them; these three are the shortcuts.
 */
export const LIGHTING_PRESETS = [
  {
    id: "warm",
    label: "Warm",
    detail: "3000K — yellow bulb, most Indian homes",
    kelvin: 3000,
  },
  {
    id: "neutral",
    label: "Neutral",
    detail: "5000K — as photographed",
    kelvin: REFERENCE_KELVIN,
  },
  {
    id: "cool",
    label: "Cool",
    detail: "6500K — daylight LED panel",
    kelvin: 6500,
  },
];

/* --------------------------------------------------------------------------- the slider */

/**
 * The slider's range, matching the bulbs a customer can actually buy: 2000K is a decorative
 * filament lamp, 8000K is an overcast-sky LED panel. Wider than the three presets on purpose --
 * the presets are the answer for people who do not want to think, the slider is for the customer
 * who knows their kitchen is lit at 4000K and wants to see exactly that.
 */
export const MIN_SLIDER_KELVIN = 2000;
export const MAX_SLIDER_KELVIN = 8000;

/**
 * What to call the temperature currently selected, in the words on a bulb box rather than a number
 * the customer has to interpret. `tone` names the room it belongs to, which is the actual decision
 * being made -- "3200K" means nothing; "most Indian homes" means something.
 */
export function describeKelvin(kelvin) {
  if (kelvin < 3500) return { label: "Warm white", tone: "most Indian homes" };
  if (kelvin < 4500) return { label: "Warm neutral", tone: "kitchens, offices" };
  if (kelvin <= 5500) return { label: "Neutral", tone: "as photographed" };
  if (kelvin <= 6800) return { label: "Cool daylight", tone: "LED panels" };
  return { label: "Overcast", tone: "north-facing rooms" };
}

/**
 * The temperature as a CSS colour, for the slider thumb and the gradient track.
 *
 * Normalised to keep the BRIGHTEST channel at 255 rather than emitting the raw blackbody values,
 * which get dim and muddy at both ends -- 2000K raw is a dark brown, and a dark brown thumb on a
 * warm track reads as "disabled", not "warm".
 */
export function kelvinToCss(kelvin) {
  const rgb = kelvinToRgb(kelvin);
  const peak = Math.max(...rgb) || 1;
  const [r, g, b] = rgb.map((c) => Math.round((c / peak) * 255));
  return `rgb(${r} ${g} ${b})`;
}

/**
 * Sample points for the gradient below, every 500K. These were once rendered as a tick row under
 * the slider; the compact popup dropped that (thirteen numbers nobody reads, costing a row of
 * photograph), so they are now only the stops the gradient is built from.
 */
const GRADIENT_STOPS = Array.from(
  { length: (MAX_SLIDER_KELVIN - MIN_SLIDER_KELVIN) / 500 + 1 },
  (_, i) => MIN_SLIDER_KELVIN + i * 500,
);

/** The track's gradient, sampled across the slider's range so it reads warm-to-cool at a glance. */
export const SLIDER_GRADIENT = `linear-gradient(to right, ${GRADIENT_STOPS.map(
  (k) => kelvinToCss(k),
).join(", ")})`;
