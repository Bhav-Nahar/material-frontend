"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Lightbulb, X } from "lucide-react";

import {
  LIGHTING_PRESETS,
  MIN_SLIDER_KELVIN,
  MAX_SLIDER_KELVIN,
  REFERENCE_KELVIN,
  SLIDER_GRADIENT,
  describeKelvin,
  kelvinToCss,
  washColor,
} from "@/lib/lighting";

/**
 * "How will this look under my lights?" -- Material Depot's Lighting Preview, rebuilt.
 *
 * Same shape as theirs, deliberately: a trigger button beside the gallery opens a bar pinned to
 * the bottom of the viewport, carrying a 2000K-8000K slider with a warm-to-cool gradient track,
 * three preset pills and a live readout. The bar is fixed rather than modal for the reason theirs
 * is -- the whole point is watching the photograph change WHILE you drag, which a dialog covering
 * the photograph would defeat.
 *
 * What is NOT copied is the colour maths. Theirs is a stack of CSS filters
 * (`sepia(.3) saturate(1.4) brightness(1.05) hue-rotate(-10deg)`), which is a plausible-looking
 * approximation with two real faults: `hue-rotate` drags saturated colours around the wheel, so a
 * terracotta tile skews pink on the way to "warm", and the stack cannot scale channels
 * independently, which is what white balance actually is. This applies a per-channel gain derived
 * from the blackbody curve instead, as a `multiply` blend -- see src/lib/lighting.js. Same feel,
 * correct on coloured stock, and composited on the GPU rather than filtered on the CPU.
 */

/**
 * The wash elements are found and repainted by attribute, and the current colour is remembered here.
 *
 * This is the single most important performance decision in the feature, and it took two attempts.
 *
 *   1. The obvious shape -- hold `kelvin` in the gallery and pass it down -- re-renders the whole
 *      gallery on every `input` of the drag: eight tiles, the Swiper instance, the thumbnail rail
 *      and the lightbox. At 6x CPU throttle: 4.2fps, 63 long tasks, longest 262ms. That is exactly
 *      the "everything freezes, cannot scroll" this was reported for.
 *   2. Moving the colour to a CSS variable on <html> fixed the React side but only got to 10.5fps,
 *      because setting a custom property on the root invalidates style for EVERY element in the
 *      document -- the whole tree recalculates sixty times a second to repaint three squares.
 *
 * So the drag writes `backgroundColor` directly onto the handful of wash elements. Style
 * invalidation is then scoped to exactly the nodes that change, React re-renders only the card, and
 * the paint itself is a GPU composite. Imperative, and the only version that is actually smooth.
 *
 * `currentWash` exists so a wash mounting mid-drag -- the incoming Swiper slide, or the lightbox
 * opening -- is born the right colour instead of flashing white for a frame.
 */
const WASH_ATTR = "data-lighting-wash";
let currentWash = "#fff";

/**
 * The tint itself: a solid colour laid over the photograph in `multiply` blend mode.
 *
 * No SVG filter, no `filter: url()`, nothing rasterised on the CPU -- see `washColor` in
 * src/lib/lighting.js for why a blend and not a colour matrix. The element is inert
 * (`pointer-events-none`) so the photograph underneath stays clickable.
 *
 * Mounted only while the bar is open, and its colour comes from the variable rather than a prop.
 * The fallback is white, which is the identity for `multiply` -- so the frame between mounting and
 * the first drag shows the photograph untouched rather than flashing a tint.
 *
 * IMPORTANT: the parent must carry `isolate`, and must be exactly the size of the photograph.
 *
 * `isolate` is what keeps the multiply blending with the photograph rather than with the page
 * behind it. The flip side, learned the hard way in the lightbox: inside an isolated group there is
 * nothing behind the wash except transparency, so ANY part of the parent the image does not cover
 * gets painted the flat wash colour instead of blended. A parent larger than its image therefore
 * shows solid cream (or, at neutral, solid white) where the image is not -- which wiped out the
 * lightbox's dark scrim and its white close button along with it.
 */
export function LightingWash({ active, style }) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      {...{ [WASH_ATTR]: "" }}
      className="pointer-events-none absolute inset-0 z-[1] mix-blend-multiply"
      // `style` lets a caller share a transform with the image it covers -- the lightbox scales
      // both together so the tint tracks the zoom instead of staying behind at 1x.
      style={{ backgroundColor: currentWash, ...style }}
    />
  );
}

/** How long the trigger announces itself before collapsing to the bulb alone. */
const PEEK_MS = 2600;

/**
 * The button that opens the bar, rendered in both breakpoints' galleries.
 *
 * It introduces itself and then gets out of the way: the label is visible on arrival, collapses to
 * the bulb icon alone after a beat, and slides back open on hover or keyboard focus. A permanent
 * label sits on top of the photograph the page exists to show; a permanent bare icon is a mystery
 * button. This is both, in the order that answers "what is this?" before it stops mattering.
 *
 * The collapse is a max-width transition on the label rather than a mount/unmount, so the text is
 * always in the accessibility tree and always in the DOM -- a screen reader and a
 * `prefers-reduced-motion` user get the full label with no animation and no timing to miss.
 */
export function LightingTrigger({ active, onClick, className = "" }) {
  const [peeking, setPeeking] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setPeeking(false), PEEK_MS);
    return () => clearTimeout(timer);
  }, []);

  // Once the bar is open the label is redundant -- the bar itself is the answer -- so the trigger
  // stays collapsed and reads as the toggle it now is.
  const expanded = peeking && !active;

  return (
    <button
      type="button"
      onClick={onClick}
      // The label has to follow the state: this button closes the bar as often as it opens it, and
      // a screen reader announcing "open lighting preview" on the thing that closes it is simply
      // wrong. `aria-pressed` carries the state too, but only the label is read on focus.
      aria-label={active ? "Close lighting preview" : "Open lighting preview"}
      aria-pressed={active}
      /* A NAMED group: the tile button next to this one already uses the bare `group` for its
         hover-zoom, and an unnamed group here would make the label expand whenever the photograph
         is hovered rather than the button. */
      className={`group/lt inline-flex items-center rounded-sm border px-2.5 py-1.5 text-[12px] leading-none transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-ink hover:border-line-strong"
      } ${className}`}
    >
      <Lightbulb className="h-3.5 w-3.5 shrink-0" />
      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-out motion-reduce:transition-none ${
          expanded
            ? "ml-1.5 max-w-[9rem] opacity-100"
            : "max-w-0 opacity-0 group-hover/lt:ml-1.5 group-hover/lt:max-w-[9rem] group-hover/lt:opacity-100 group-focus-visible/lt:ml-1.5 group-focus-visible/lt:max-w-[9rem] group-focus-visible/lt:opacity-100"
        }`}
      >
        Lighting preview
      </span>
    </button>
  );
}

/**
 * The popup: one small floating card, both breakpoints.
 *
 * COMPACTNESS IS THE FEATURE, not styling. Two earlier versions failed on a phone for opposite
 * reasons -- a tall floating card covered the bottom of the very tile it was tinting, and moving it
 * inline below the image meant scrolling between the tile and the slider, which defeats the point
 * of a live preview. Both problems are the same problem: the control was too big.
 *
 * It renders through a PORTAL onto <body>, above the lightbox. That is what lets one bar serve
 * both the page and the zoomed view -- the zoom is a Radix dialog at z-2000 in its own portal, and
 * a bar living inside the gallery tree could only ever be painted under it. (Material Depot solves
 * it the same way: their slider is a body-level fixed portal that paints over their lightbox, which
 * is why their state carries across too.)
 *
 * At three tight rows (~110px) it fits in the gap that already exists. On a 375x667 phone the
 * header takes 105 and a square image 375, ending at 480; the card sits above the buy bar at
 * 667-69-110 = 488. It clears the image with nothing shrunk, nothing hidden and nothing to scroll.
 *
 * Which is also why the readout shares a line with the title and the Kelvin ticks are gone: every
 * row removed is a row of photograph kept.
 */
function LightingBar({ onClose }) {
  /*
    The temperature lives HERE, not in the gallery, so a drag re-renders this card and nothing else.
    The photographs are updated by writing the CSS variable straight to <html> -- see WASH_VAR.
  */
  const [kelvin, setKelvin] = useState(REFERENCE_KELVIN);
  const [explaining, setExplaining] = useState(false);
  const { label, tone } = describeKelvin(kelvin);

  useEffect(() => {
    currentWash = washColor(kelvin);
    for (const node of document.querySelectorAll(`[${WASH_ATTR}]`)) {
      node.style.backgroundColor = currentWash;
    }
  }, [kelvin]);

  // Leave nothing behind. The washes unmount with the bar, but `currentWash` is module state and
  // would otherwise tint the next gallery on a client-side navigation before its bar was opened.
  useEffect(() => () => { currentWash = "#fff"; }, []);

  /*
    Flag the document while the bar is open so the WhatsApp/call FABs can get out of the way. They
    are `position: fixed` bottom-right in the same band this card occupies on a phone, and they
    landed squarely on the cool end of the slider -- the temperature you physically could not drag
    to. A data attribute and one CSS rule, rather than lifting those buttons into React state they
    have no other reason to have (they are a server component today).
  */
  useEffect(() => {
    document.body.dataset.lightingPreview = "";
    return () => delete document.body.dataset.lightingPreview;
  }, []);

  const card = (
    <div
      role="group"
      aria-label="Lighting preview"
      /* Marks the bar for the lightbox's outside-click guard: Radix would otherwise treat a click
         on this card as a click outside the dialog and close the zoom mid-drag. */
      data-lighting-bar
      /* Above the phone buy bar, at the screen edge on desktop where there is no buy bar.
         `max-w-sm`, not `max-w-xl`: a 384px card is as wide as this needs, and a narrow one reads
         as a tool rather than a drawer. */
      /*
        `pointer-events-auto` is REQUIRED, not defensive. Radix puts `pointer-events: none` on
        <body> while a modal dialog is open and re-enables it only inside the dialog content; this
        card is a body-level sibling, so it inherited the block and sat there looking interactive
        while every click fell through to the photograph behind it. Material Depot's own slider
        portal carries the same class for the same reason.
      */
      className="pointer-events-auto fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[2100] mx-auto w-auto max-w-sm rounded-lg border border-line bg-surface/95 shadow-lg backdrop-blur-md sm:inset-x-0 lg:bottom-4"
    >
      <div className="flex flex-col gap-2 p-2.5">
        {/* ------------------------------------------------- title, live readout, controls */}
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-ink/70" />

          {/* The readout rides on the title line rather than owning a row of its own. */}
          <span className="flex-1 truncate text-[11px] leading-none text-ink">
            <span className="font-medium uppercase tracking-wide">{label}</span>
            <span className="num text-ink/60"> · {kelvin}K</span>
          </span>

          <button
            type="button"
            onClick={() => setExplaining((v) => !v)}
            aria-expanded={explaining}
            aria-label="What does this do?"
            className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] transition-colors ${
              explaining
                ? "border-ink bg-ink text-white"
                : "border-line text-ink/60 hover:border-line-strong hover:text-ink"
            }`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close lighting preview"
            className="grid h-6 w-6 place-items-center rounded-full text-ink/60 transition-colors hover:bg-paper hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The explanation lives behind the "i" rather than sitting under the slider permanently.
            It answers a question asked once, and a caveat nobody reads is worse than one they
            opened deliberately. */}
        {explaining && (
          <p className="rounded-sm bg-paper p-2 text-[10px] leading-relaxed text-ink/70">
            Bulbs have a colour of their own, and it changes how a surface looks — the same tile
            reads creamy under a warm yellow bulb and slightly blue under a daylight LED. Drag the
            slider to the lighting in your room to see the shift.
            <span className="mt-1.5 block text-ink/50">
              A guide, not a colour match — screens vary. Order a ₹99 sample if the exact shade
              matters.
            </span>
          </p>
        )}

        {/* ---------------------------------------------------------------- the slider */}
        <div className="flex flex-col">
          <input
            type="range"
            className="lighting-slider"
            min={MIN_SLIDER_KELVIN}
            max={MAX_SLIDER_KELVIN}
            step={100}
            value={kelvin}
            onChange={(e) => setKelvin(Number(e.target.value))}
            aria-label="Colour temperature in kelvin"
            aria-valuetext={`${label}, ${kelvin} kelvin`}
            style={{ "--thumb": kelvinToCss(kelvin), "--track": SLIDER_GRADIENT }}
          />

          {/* The two ends in words. The 2k-8k tick row that used to sit here was thirteen
              numbers nobody reads costing a row of photograph; "warmer" is what orients someone. */}
          <div
            aria-hidden="true"
            className="flex justify-between text-[9px] leading-none text-ink/40"
          >
            <span>Warmer</span>
            <span>Cooler</span>
          </div>
        </div>

        {/* ---------------------------------------------------------------- presets */}
        <div className="flex items-center justify-between gap-2">
          {/* What the temperature MEANS, which is the only part of the old readout row worth a
              line of its own -- "3000K" is a number, "most Indian homes" is the decision. */}
          <span className="truncate text-[10px] leading-none text-ink/45">{tone}</span>

          <div className="flex shrink-0 gap-1.5">
            {LIGHTING_PRESETS.map((preset) => {
              const active = preset.kelvin === kelvin;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setKelvin(preset.kelvin)}
                  aria-pressed={active}
                  title={preset.detail}
                  className={`rounded-sm border px-2 py-1 text-[11px] leading-none transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-paper text-ink hover:border-line-strong"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // Only ever called from a click, so `document` exists; the guard is for safety, not SSR.
  return typeof document === "undefined" ? card : createPortal(card, document.body);
}

export { LightingBar };

export { REFERENCE_KELVIN };
