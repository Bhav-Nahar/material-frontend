"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YARL from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import shopifyLoader from "@/utils/shopifyLoader";
import { LightingTrigger, LightingWash } from "@/components/product/LightingPreview";

/**
 * The zoomed view.
 *
 * WHY THIS IS A LIBRARY NOW (user, 2026-08-25). The hand-rolled version was a native scroll-snap
 * rail plus a click-to-zoom transform plus two refs arbitrating between them, and every feature
 * anyone asked for after that arrived as another rule in the same knot: don't align the rail while
 * momentum is running, don't let a zoomed drag slide the next photograph in, don't let the wash
 * paint the scrim, don't let the dialog close when the slider is touched. It reached ~200 lines and
 * still had no pinch-zoom, no swipe-to-dismiss and no momentum on a zoomed pan -- the three things
 * a shopper judging a tile actually reaches for on a phone.
 *
 * yet-another-react-lightbox is ~20KB gzipped for what we use, has no dependencies of its own, and
 * brings pinch, double-tap, wheel zoom, panning, swipe-to-close, preloading, focus trap, scroll
 * lock, keyboard and the ARIA all done. What is left here is the wiring and the one thing no
 * library ships: the lighting preview.
 *
 * THE LIGHTING PREVIEW, kept and simplified. The old wash had to live INSIDE each slide, sized
 * exactly to the photograph, because `mix-blend-multiply` inside an isolated group paints flat
 * colour anywhere the image does not reach -- which is what once turned the dark scrim solid cream.
 * Here it is one viewport-sized layer over the whole lightbox instead, which is correct rather than
 * lazy: multiply against the near-black backdrop leaves it near-black, so only the photograph takes
 * the tint. It also survives zoom and pan for free, because it covers the viewport rather than
 * tracking a transform the way the old one had to.
 */

/** The lighting bar's height plus its offset and a gutter -- what the photograph gives up for it. */
const BAR_SPACE = "9rem";

/*
  Breathing room around the photograph, carried over from the hand-rolled lightbox because the
  library has no opinion about it and the default -- none -- is wrong. Vertical is the generous one:
  it is the axis a landscape monitor is short of, and the axis the close button and the counter sit
  on. Without it the picture runs flush to y=0 and its top edge lives underneath the toolbar, which
  is the "the image is cut off at the top" report.

  Asymmetric on purpose, and `clamp` so a phone is not asked to give away width it does not have.

  The vertical FLOOR is 4rem rather than the 1rem the hand-rolled version used, and it is not a
  round number picked for looks: the toolbar is 64px tall, so anything less leaves the top of the
  photograph underneath the close button on a short window -- measured at 680px tall, where 7vh is
  48px and the top 16px of the picture sat under the toolbar.
*/
const INSET_Y = "clamp(4rem, 7vh, 5rem)";
const INSET_X = "clamp(0.5rem, 3vw, 4rem)";

/** Shopify resizes on its own CDN, so a srcSet is four query strings rather than four uploads. */
const WIDTHS = [640, 1080, 1600, 2048];

const toSlide = (img) => ({
  src: shopifyLoader({ src: img.url, width: 1600 }),
  alt: img.altText || "",
  width: img.width || undefined,
  height: img.height || undefined,
  srcSet: WIDTHS.map((width) => ({
    src: shopifyLoader({ src: img.url, width }),
    width,
    // Height keeps the aspect ratio honest so the library can reserve the right box before the
    // bytes land. Falls back to the width when Shopify did not report dimensions.
    height: img.width && img.height ? Math.round((width * img.height) / img.width) : width,
  })),
});

export default function GalleryLightbox({
  open,
  onClose,
  images,
  index,
  onIndex,
  title,
  lightingOn,
  onToggleLighting,
  onContainer,
}) {
  // Thumbnails are worth a strip of a desktop screen and are not worth a fifth of a phone's, where
  // the swipe is the navigation. Chosen at open time, on the client, which is safe precisely
  // because this component only ever mounts from a tap.
  const [wide] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(min-width: 1024px)").matches,
  );

  /* Which photograph is on screen. A ref, not state -- see the note on `on.view` below. */
  const viewing = useRef(index);

  const [controls, setControls] = useState(null);
  const holdControls = useCallback(
    (node) => {
      setControls(node);
      onContainer(node); // the lighting bar portals in here
    },
    [onContainer],
  );

  /*
    A DRAG ON THE SLIDER IS NOT A SWIPE ON THE CAROUSEL.
    The bar portals into a node that sits inside the lightbox's own container, so a drag along the
    temperature slider bubbled into the carousel's gesture sensors and paged the photographs
    instead: dragging from neutral toward warm walked the gallery from 1/8 to 8/8 while the
    temperature never moved.

    Native listeners on the portal target, not React's onPointerDown -- the bar renders through a
    portal, so its React tree is the gallery's rather than this one's, and a synthetic handler here
    would never see the event. Stopping it here is also why the bar keeps working: its own buttons
    and slider are dispatched down its own React tree, which this does not sit on.
  */
  useEffect(() => {
    if (!controls) return;
    const stop = (e) => e.stopPropagation();
    const types = ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove"];
    for (const type of types) controls.addEventListener(type, stop);
    return () => {
      for (const type of types) controls.removeEventListener(type, stop);
    };
  }, [controls]);

  if (!images?.length) return null;

  return (
    <YARL
      open={open}
      close={() => {
        onIndex(viewing.current);
        onClose();
      }}
      index={index}
      slides={images.map(toSlide)}
      plugins={wide ? [Zoom, Counter, Thumbnails] : [Zoom, Counter]}
      /*
        THE PARENT IS TOLD ON THE WAY OUT, NOT ON EVERY SWIPE, and that is a correctness fix rather
        than an optimisation. `index` is a semi-controlled prop: writing the parent's index on each
        view sent it straight back in as a new `index`, and the library obeyed it. With the update
        deferred the value arriving was a swipe out of date, so the fifth tap on Next went 5/8 and
        then back to 4/8 -- the two of them arguing over which slide is current.
        A ref records what the shopper is looking at, costs no render while they browse, and the
        page rail is moved to match once, at the close. Which is the only moment it matters: the
        gallery underneath is not on screen until then.
      */
      on={{ view: ({ index: next }) => { viewing.current = next; } }}
      controller={{
        closeOnBackdropClick: true,
        // Drag the photograph down to dismiss. The gesture people try first on a phone, and the
        // one the hand-rolled version never had.
        closeOnPullDown: true,
      }}
      carousel={{ finite: false, padding: 0, spacing: 0, preload: 1 }}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
        doubleTapDelay: 250,
        doubleClickMaxStops: 1,
      }}
      animation={{ fade: 200, swipe: 300 }}
      styles={{
        // The brand's ink at the same opacity the old dialog used, so opening a photograph looks
        // like the same site rather than a component with its own idea of black.
        container: { backgroundColor: "rgba(28, 27, 25, 0.96)" },
        thumbnailsContainer: { backgroundColor: "rgba(28, 27, 25, 0.96)" },
        /*
          THE CHROME PAINTS ABOVE THE WASH. A blend mode mixes an element with whatever is painted
          beneath it, and the library renders its toolbar and arrows BEFORE our `controls` slot --
          so without this the tint lands on the close button and the arrows too, and at a warm
          setting the white close cross goes amber. One z-index each puts them back on top, where
          they are chrome rather than photograph.
        */
        /*
          The inset, plus room for the bar when it is open -- taken from the photograph rather than
          laid on top of it. Without the bottom half the two only miss each other by luck: on a
          short or landscape screen the card lands across the bottom of the picture, which is the
          part of the tile someone opened this to look at.

          On the SLIDE rather than `carousel.padding`, which is a single value for all four sides
          and so cannot be asymmetric. The library measures the slide box when it sizes an image,
          so padding here genuinely shrinks the picture instead of pushing it off an edge.
        */
        slide: {
          paddingTop: INSET_Y,
          paddingLeft: INSET_X,
          paddingRight: INSET_X,
          paddingBottom: lightingOn ? `calc(${INSET_Y} + ${BAR_SPACE})` : INSET_Y,
        },
        toolbar: { zIndex: 2 },
        navigationPrev: { zIndex: 2 },
        navigationNext: { zIndex: 2 },
      }}
      counter={{ container: { style: { zIndex: 2 } } }}
      thumbnails={{ width: 72, height: 72, gap: 8, border: 0, borderRadius: 2, padding: 0 }}
      // Alt text belongs to the photograph; the product name is the accessible name of the dialog.
      labels={{ Next: "Next photo", Previous: "Previous photo", Close: "Close" }}
      aria-label={title}
      render={{
        /*
          Rendered inside the lightbox and over the slides, so the tint lands on the photograph;
          the z-indexes above lift the library's own chrome back over the top of it.

          The ref is how the lighting bar gets in here. It portals into this node rather than onto
          <body> because the lightbox locks scrolling and cancels touchmove outside itself: a
          body-level slider accepted a tap and ignored a DRAG, on the one screen people open
          specifically to judge colour.
        */
        controls: () => (
          <div ref={holdControls} className="pointer-events-none absolute inset-0">
            <LightingWash active={lightingOn} style={{ position: "fixed", inset: 0 }} />

            {/* Centred under the photograph rather than parked in a corner -- it belongs to the
                picture, and this is the one control on the screen that is about the picture rather
                than about the gallery. Hidden while the bar is open: the bar sits in exactly this
                spot and carries its own close, so leaving the trigger under it is one button too
                many arguing over the same 40px. */}
            {!lightingOn && (
              <LightingTrigger
                active={lightingOn}
                onClick={onToggleLighting}
                className="pointer-events-auto absolute bottom-6 left-1/2 z-[1] -translate-x-1/2 shadow-sm"
              />
            )}
          </div>
        ),
      }}
    />
  );
}
