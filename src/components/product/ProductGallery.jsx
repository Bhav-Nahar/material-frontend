"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  LightingBar,
  LightingTrigger,
  LightingWash,
} from "@/components/product/LightingPreview";

/**
 * The PDP gallery, following the jewelry build's arrangement:
 *
 *   DESKTOP -- every image at once, in a two-column mosaic, sticky beside the buy box. No
 *              thumbnail rail and no "main" image, so nothing is one click away: a shopper
 *              deciding on a floor sees the room shot and the plank detail side by side, which is
 *              the comparison they are actually making. Material Depot's thumbnails-plus-hero
 *              shows one image and hides the rest.
 *
 *   MOBILE  -- a full-bleed swipeable image with a thumbnail strip under it, again theirs.
 *
 *   BOTH    -- tap or click opens a lightbox with arrows, keyboard navigation and click-to-zoom.
 *
 * What is NOT carried over from the jewelry build's 723 lines: the alt-text bucketing that reorders
 * images by metal colour, video and 360-spin slides, the try-on button, the "similar items"
 * overlay, and the pinch/wheel zoom rig. The zoom here is one click, one transform.
 */

/** Height of the sticky site header (measured), plus a gutter. */
const HEADER = 168;

/**
 * How many photographs the DESKTOP mosaic shows inline. The mosaic used to render every image, two
 * per row, so a ten-image product built a 1552px column beside a 670px buy box -- 882px, 57% of the
 * right-hand column, blank paper (user, 2026-08-21). Four keeps the mosaic two rows tall, which is
 * about the height of the buy box, and the rest are one click away in the lightbox that already
 * exists. Mobile is untouched: the rail there costs no vertical space per extra image.
 */
const MOSAIC_MAX = 4;

/**
 * Breathing room around the zoomed photograph. Vertical is the generous one -- it is the axis a
 * landscape monitor is short of, and the axis the close button and counter sit on.
 */
const LIGHTBOX_INSET_X = "clamp(0.5rem, 3vw, 4rem)";
const LIGHTBOX_INSET_Y = "clamp(1rem, 7vh, 5rem)";

/**
 * Room kept at the bottom for the lighting bar when it is open, so the photograph sits clear of it
 * rather than under it. Its own height (~116px) plus its bottom offset and a gutter.
 */
const LIGHTBOX_BAR_SPACE = "9rem";

export default function ProductGallery({ images, title, tag, wishlisted, onWishlist, onShare }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  /**
   * The lighting preview: whether the bar is open, and the temperature it is set to.
   *
   * Held HERE rather than in the bar because the temperature has to reach four places that render
   * the same photographs -- the desktop mosaic, the mobile rail, the thumbnail strip and the
   * lightbox. A shopper who warms the swatch and then opens it full-screen to look closer is doing
   * exactly the thing the feature exists for; the lightbox snapping back to neutral would throw
   * the comparison away at the moment it matters most.
   *
   * Only the OPEN flag lives here. The chosen temperature is the bar's own state and reaches the
   * photographs as a CSS variable, so dragging the slider re-renders the card and not this gallery
   * -- see WASH_VAR in LightingPreview for the measurements that forced that split.
   */
  const [lightingOpen, setLightingOpen] = useState(false);

  /* The mosaic opens IN PLACE rather than sending the extra photographs to the lightbox (user,
     2026-08-21): comparing a room shot against a plank detail is the whole job of this gallery, and
     a lightbox shows one image at a time, which is the opposite of a comparison. */
  const [expanded, setExpanded] = useState(false);




  const railRef = useRef(null);
  const gridRef = useRef(null);

  /* The lightbox's dialog content, once mounted. The lighting bar portals into it while the zoom
     is open so Radix's scroll lock does not eat the slider's drag -- see the portal in LightingBar. */
  const [lightboxEl, setLightboxEl] = useState(null);
  const [stickyTop, setStickyTop] = useState(HEADER);

  /**
   * The jewelry build's sticky trick, in six lines rather than twenty: a mosaic TALLER than the
   * viewport gets a negative offset, so it keeps scrolling until its last image sits against the
   * bottom of the screen and then pins. A short one just pins under the header. Without this a tall
   * gallery pins at the top and its bottom images can never be reached while the buy box is still
   * in view.
   */
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const fit = () => setStickyTop(Math.min(HEADER, window.innerHeight - el.offsetHeight - 24));
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  if (images.length === 0) return null;

  /**
   * ONE image spans both columns, square, because half a gallery showing nothing at all is the
   * single worst thing this column can do on a page selling how a material looks.
   *
   * It fills the column -- ~780px square on a 1440px screen. That IS large, and capping it to 560
   * was tried (user, 2026-08-13) and reverted: the gallery column stays 768px wide whatever the
   * photograph does, so a narrower image just moves the emptiness rather than removing it, leaving
   * a 208px dead strip between the picture and the buy box that read worse than the size did.
   * A capped image also has to carry the cap on the GRID, not on the tile -- the tag and the
   * wishlist/share controls are positioned against the grid, so a narrow tile in a wide grid leaves
   * them floating in the margin. Both problems go away by simply letting it fill.
   *
   * The height costs nothing on the buy side: gallery and buy box are separate tracks of the PDP's
   * 12-column grid, so the price and Add to Cart sit at the top of their own column regardless.
   *
   * The ratio stays 1:1 rather than dropping to 4:3 to buy the height back, because tile
   * photography is shot square and `object-cover` at 4:3 would crop the top and bottom off it.
   *
   * EVERY OTHER COUNT tiles as equal squares -- three, five and seven included (user, 2026-08-13).
   * They previously promoted the first image to a 4:3 hero to fill the odd row's spare cell, but a
   * hero declares one photograph the important one, and on a material that is a claim the catalogue
   * cannot make: the room shot and the plank detail are the comparison the shopper is running, and
   * equal tiles are what let them run it. An odd count therefore leaves the last cell empty, which
   * is the accepted cost.
   */
  const solo = images.length === 1;

  /**
   * ONE sizes string per image, shared by the desktop mosaic and the mobile rail below.
   *
   * They must agree or the hidden-but-rendered copy costs a second download of the same photograph
   * -- the bug the original comment here was written about. A lone spanning image really is ~60vw
   * of a desktop viewport and 100vw of a phone, so one string covers both.
   */
  const sizesFor = () =>
    solo ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, 100vw";

  const show = (i) => {
    setIndex(i);
    setOpen(true);
  };

  const goto = (i) => {
    const next = (i + images.length) % images.length;
    setIndex(next);
    const rail = railRef.current;
    if (rail) rail.scrollTo({ left: next * rail.clientWidth, behavior: "smooth" });
  };

  /**
   * Which slide the rail has settled on. Read off scrollLeft rather than tracked with an observer:
   * one division against a full-width slide is exact, and setState only fires when the answer
   * changes, so a flick costs one re-render rather than one per frame.
   */
  const onRailScroll = (e) => {
    const el = e.currentTarget;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index && next >= 0 && next < images.length) setIndex(next);
  };

  return (
    <>
      {/* ================================ DESKTOP MOSAIC ================================ */}
      <div
        ref={gridRef}
        style={{ top: `${stickyTop}px` }}
        className="sticky hidden grid-cols-2 gap-4 lg:grid"
      >
        {images.slice(0, expanded ? images.length : MOSAIC_MAX).map((img, i) => (
          /*
            Each tile is WRAPPED rather than being the grid child itself, for one reason: the
            lighting trigger belongs in the corner of the FIRST photograph, and a <button> cannot
            legally contain another <button>. The wrapper gives the trigger something tile-shaped to
            position against -- against the grid it would land on the last tile in the mosaic
            instead, which reads as belonging to that photograph.
          */
          <div
            key={img.url}
            className={`relative ${solo ? "col-span-2" : ""}`}
          >
            <button
              type="button"
              onClick={() => show(i)}
              aria-label={`Enlarge image ${i + 1} of ${images.length}`}
              className="group relative isolate block aspect-swatch w-full cursor-zoom-in overflow-hidden rounded-sm border border-line bg-paper"
            >
              <Image
                src={img.url}
                alt={img.altText || (i === 0 ? title : "")}
                fill
                // The SAME sizes as the mobile block below, so both request an identical URL and
                // the hidden-but-rendered copy costs nothing. They diverged before this, which made
                // a desktop load fetch every photograph twice.
                sizes={sizesFor()}
                priority={i < 2}
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <LightingWash active={lightingOpen} />
            </button>

            {i === 0 && (
              <LightingTrigger
                active={lightingOpen}
                onClick={() => setLightingOpen((v) => !v)}
                className="absolute bottom-3 left-3 z-10 shadow-sm"
              />
            )}
          </div>
        ))}

        {/* Reveals the rest of the mosaic in place. Each tile keeps its own click-to-zoom, so the
            lightbox is still one click away from any photograph -- it is just no longer the only way
            to reach the ones past the fold. */}
        {images.length > MOSAIC_MAX && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="col-span-2 cursor-pointer rounded-sm border border-line bg-surface py-3 text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-line-strong"
          >
            {expanded ? "Show fewer photos" : `View all ${images.length} photos`}
          </button>
        )}

        {/* Badge and controls are positioned against the grid itself, which puts them over the FIRST
            tile -- the one corner that is a tile at every image count. */}
        {tag && <Tag>{tag}</Tag>}
        <Controls
          wishlisted={wishlisted}
          onWishlist={onWishlist}
          onShare={onShare}
          title={title}
        />
      </div>

      {/* =================================== MOBILE ===================================
          Full-bleed: the container's gutter is cancelled so the photograph runs edge to edge. */}
      <div className="lg:hidden">
        <div className="relative mx-[calc(clamp(1rem,3vw,2.5rem)*-1)]">
          {/*
            NATIVE scroll-snap, not Swiper. Every slide is filled by a <button> so the photograph
            can be tapped open, and Swiper deliberately skips its own touchstart preventDefault on
            form elements -- so the browser read every drag as a press on that button and the
            gallery could only be moved with the thumbnail rail (user, 2026-08-23). Forcing
            Swiper's hand with touchStartForcePreventDefault also suppresses the synthesised tap
            that opens the lightbox, which trades one broken gesture for the other.

            A one-per-view image carousel is what overflow-x plus snap-mandatory already is: the
            drag is the browser's own, so it is smooth and interruptible for free, the tap still
            fires because a scrolled gesture cancels the click by itself, and the JS left is one
            division in onRailScroll. Swiper stays where it earns its keep -- ProductRail's
            free-mode multi-slide rails.
          */}
          <div
            ref={railRef}
            onScroll={onRailScroll}
            className="no-scrollbar aspect-swatch flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          >
            {images.map((img, i) => (
              <div key={img.url} className="w-full shrink-0 snap-center">
                <button
                  type="button"
                  onClick={() => show(i)}
                  aria-label={`Enlarge image ${i + 1} of ${images.length}`}
                  className="relative isolate block h-full w-full bg-paper"
                >
                  <Image
                    src={img.url}
                    alt={img.altText || (i === 0 ? title : "")}
                    fill
                    sizes={sizesFor()}
                    priority={i === 0}
                    className="object-cover"
                  />
                  {/* Only the slide ON SCREEN is washed. The blend is cheap, but eight of them is
                      eight composited layers for seven photographs nobody is looking at. The
                      onRailScroll re-renders with the new index, so the incoming slide is tinted
                      before it finishes moving in. */}
                  {i === index && <LightingWash active={lightingOpen} />}
                </button>
              </div>
            ))}
          </div>

          {tag && <Tag>{tag}</Tag>}
          <Controls
            wishlisted={wishlisted}
            onWishlist={onWishlist}
            onShare={onShare}
            title={title}
          />

          <LightingTrigger
            active={lightingOpen}
            onClick={() => setLightingOpen((v) => !v)}
            className="absolute bottom-3 left-3 z-10 shadow-sm"
          />

          {images.length > 1 && (
            <span className="num absolute bottom-3 right-3 z-10 rounded-sm bg-surface/60 px-2 py-0.5 text-[11px] text-ink backdrop-blur-md">
              {index + 1}/{images.length}
            </span>
          )}
        </div>

        {/* Thumbnail strip, theirs. Buttons that scroll the rail above, rather than a second
            Swiper with the Thumbs module: same behaviour, no carousel library at all. */}
        {images.length > 1 && (
          <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <li key={img.url}>
                <button
                  type="button"
                  onClick={() => goto(i)}
                  aria-label={`View image ${i + 1}`}
                  aria-current={i === index}
                  className={`relative block aspect-swatch w-14 shrink-0 overflow-hidden rounded-sm border ${
                    i === index ? "border-ink" : "border-line"
                  }`}
                >
                  {/* Deliberately UNFILTERED: eight more rasterisations to tint a 56px square
                      nobody is judging a colour from, and they were a measurable part of the jank
                      while dragging. The thumbnails are for navigation; the big image is the one
                      making the argument. */}
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lightingOpen && (
        <LightingBar
          onClose={() => setLightingOpen(false)}
          container={open ? lightboxEl : null}
        />
      )}

      <Lightbox
        open={open}
        onOpenChange={setOpen}
        images={images}
        index={index}
        onIndex={goto}
        title={title}
        lightingOn={lightingOpen}
        onToggleLighting={() => setLightingOpen((v) => !v)}
        contentRef={setLightboxEl}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- lightbox */

/**
 * Radix's Dialog does the focus trap, the Esc key and the scroll lock, so this is the picture, two
 * arrows and one zoom transform. The jewelry build hand-rolls all of it, including a body-overflow
 * effect that leaks `overflow: unset` onto <body> when the component unmounts mid-transition.
 */
function Lightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndex,
  title,
  lightingOn,
  onToggleLighting,
  contentRef,
}) {
  const [zoom, setZoom] = useState(null); // {x, y} as percentages, or null for fit

  // Any change of picture drops the zoom -- otherwise the next image opens scrolled to a corner
  // of the last one.
  useEffect(() => setZoom(null), [index, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") onIndex(index + 1);
      if (e.key === "ArrowLeft") onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, onIndex]);

  const image = images[index];
  if (!image) return null;

  // The photograph's aspect ratio as a bare number, for the sizing below.
  const ratio = (image.width || 1) / (image.height || 1);

  // One transform, shared by the photograph and the wash over it.
  const zoomStyle = {
    transform: zoom ? "scale(2.5)" : "scale(1)",
    transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
  };

  // Click to zoom to the point clicked, click again to fit. Two states, no drag, no pinch: the
  // photography is 1200px wide, so anything past ~2.5x is showing the customer the compression.
  const toggleZoom = (e) => {
    if (zoom) return setZoom(null);
    const box = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* text-white is for the Dialog's own close button, which otherwise inherits charcoal ink
          and disappears against the scrim. */}
      <DialogContent
        ref={contentRef}
        aria-describedby={undefined}
        /*
          The lighting bar is a body-level portal, so as far as Radix is concerned a click on it is
          a click OUTSIDE the dialog -- which would shut the zoom the moment you reached for the
          slider. Both handlers are needed: pointer-down fires first on a drag, interact-outside
          also covers focus and touch.
        */
        onPointerDownOutside={(e) => {
          if (e.target.closest?.("[data-lighting-bar]")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (e.target.closest?.("[data-lighting-bar]")) e.preventDefault();
        }}
        className="h-dvh w-screen max-w-none gap-0 rounded-none border-0 bg-ink/95 p-0 text-white sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* The padding is what moves the photograph UP when the bar is open; the height budget
            below is reduced by the same amount so it shrinks to fit rather than overflowing. */}
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{ paddingBottom: lightingOn ? LIGHTBOX_BAR_SPACE : undefined }}
        >
          {/*
            The wrapper SHRINK-WRAPS the photograph rather than filling the dialog, and that is a
            correctness requirement, not tidiness. `LightingWash` needs `isolate` to blend with the
            image, and inside an isolated group anything the image does not cover gets painted the
            flat wash colour -- so a full-bleed wrapper turned the dark scrim solid cream, and solid
            WHITE at neutral, taking the white close button with it.

            `inline-flex` plus `max-h-full max-w-full` on both wrapper and image gives a box exactly
            the size of the letterboxed photograph, so the wash lands only on pixels.
          */}
          <div
            onClick={toggleZoom}
            /*
              The box is exactly the letterboxed photograph, which is what the wash needs to avoid
              painting the scrim (see LightingWash). Getting there took three tries:

                - the image's own natural size: Shopify serves a 450px variant of a 600px original,
                  so the zoom opened at 450px inside a 900px dialog -- smaller than the thumbnail
                  that opened it;
                - `aspect-ratio` with `max-h-full`: as a flex item the max-height simply did not
                  clamp, and a square went 1440x1440 inside a 1440x900 dialog.

              So it is sized in VIEWPORT units, which is honest here because this dialog IS the
              viewport (`h-dvh w-screen`, no padding): take all the width available, unless the
              height runs out first. `dvh` so a phone's collapsing address bar does not crop it.

              The two insets are what stop a square photograph filling the screen edge to edge on
              desktop, which read as a page that had broken rather than an image that had opened.
              They are asymmetric on purpose: vertical space is what a landscape monitor is short
              of, and it is also where the close button and the image counter live. `clamp` keeps a
              phone from giving away width it does not have.
            */
            className={`relative isolate ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            style={{
              aspectRatio: ratio,
              width: `min(
                calc(100vw - 2 * ${LIGHTBOX_INSET_X}),
                calc((100dvh - 2 * ${LIGHTBOX_INSET_Y} - ${
                  lightingOn ? LIGHTBOX_BAR_SPACE : "0px"
                }) * ${ratio})
              )`,
            }}
          >
            <Image
              src={image.url}
              alt={image.altText || title}
              fill
              sizes="100vw"
              // `contain` inside a box that already has the image's ratio means no letterbox is
              // left inside the box -- the box IS the picture, which is why the wash can simply
              // cover it.
              className="object-contain transition-transform duration-300"
              style={zoomStyle}
            />
            {/* Same transform as the image, so the tint zooms with it rather than sitting still. */}
            <LightingWash active={lightingOn} style={zoomStyle} />
          </div>

          {/* Judging a colour is what people zoom in FOR, so the control has to be reachable from
              here and not only from the page behind. The bar itself is shared, not duplicated --
              this only opens it. */}
          <LightingTrigger
            active={lightingOn}
            onClick={onToggleLighting}
            className="absolute left-4 top-4 z-20 shadow-sm"
          />

          {images.length > 1 && (
            <>
              <ArrowButton side="left" onClick={() => onIndex(index - 1)} />
              <ArrowButton side="right" onClick={() => onIndex(index + 1)} />
              {/* Moves to the TOP while the bar is open. Nudging it up the bottom edge was tried
                  and there is no offset that clears the bar on a phone and still looks deliberate
                  on desktop -- the top edge is simply free, between the trigger and the close. */}
              <span
                className={`num absolute left-1/2 z-20 -translate-x-1/2 rounded-sm bg-surface/80 px-2.5 py-1 text-xs text-ink ${
                  lightingOn ? "top-4" : "bottom-5"
                }`}
              >
                {index + 1}/{images.length}
              </span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArrowButton({ side, onClick }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm bg-surface/80 text-ink transition-colors hover:bg-surface ${
        side === "left" ? "left-3 lg:left-6" : "right-3 lg:right-6"
      }`}
    >
      <Icon size={20} strokeWidth={1.5} />
    </button>
  );
}

/* -------------------------------------------------------------------------- pieces */

/** Same frosted plate as ProductCard's controls -- see the note there for why blur, not fill. */
const CONTROL =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm bg-surface/60 text-ink backdrop-blur-md transition-colors hover:bg-surface";

function Controls({ wishlisted, onWishlist, onShare, title }) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
      <button
        type="button"
        onClick={onWishlist}
        aria-label={wishlisted ? `Remove ${title} from wishlist` : `Save ${title}`}
        aria-pressed={wishlisted}
        className={CONTROL}
      >
        <Heart size={17} strokeWidth={1.5} className={wishlisted ? "fill-current text-action" : ""} />
      </button>
      <button type="button" onClick={onShare} aria-label="Share this product" className={CONTROL}>
        <Share2 size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-sm bg-ink px-2.5 py-1 text-[11px] leading-none text-white">
      {children}
    </span>
  );
}
