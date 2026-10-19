"use client";

import { startTransition, useRef, useState } from "react";
import Image from "next/image";
import { Heart, Share2 } from "lucide-react";
import {
  LightingBar,
  LightingTrigger,
  LightingWash,
} from "@/components/product/LightingPreview";
import GalleryLightbox from "@/components/product/GalleryLightbox";
import { useStickyFit } from "@/hooks/useStickyFit";

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

/*
 * THE MOSAIC SHOWS EVERY PHOTOGRAPH (user, 2026-09-05). It was capped at four behind a "View all N
 * photos" button, because ten images built a 1552px column beside a 670px buy box and left 882px of
 * blank paper down the right -- 57% of that column. The cap was the wrong half of that problem to
 * fix: the buy box is sticky now (useStickyFit, applied to both columns), so it rides down the page
 * beside the extra rows instead of leaving them facing nothing. The blank paper is gone, and with it
 * the reason to hide photographs of the material behind a click on a page that sells how it looks.
 */

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

  const railRef = useRef(null);

  /* Pins beside the buy box -- and lets the buy box pin beside IT when the gallery is the taller of
     the two. See useStickyFit. */
  const [gridRef, stickyTop] = useStickyFit();

  /* The lightbox's dialog content, once mounted. The lighting bar portals into it while the zoom
     is open so Radix's scroll lock does not eat the slider's drag -- see the portal in LightingBar. */
  const [lightboxEl, setLightboxEl] = useState(null);

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
   * equal tiles are what let them run it. An odd count therefore leaves the last cell empty -- and
   * since 2026-10-19 genuinely empty, with no border round it (see the mosaic's className).
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
   *
   * THE RE-RENDER IS A TRANSITION (user, 2026-08-24), which is what makes the swipe smooth. One
   * re-render per slide is cheap to say and expensive to do: it re-renders every slide in the rail,
   * and as an urgent update React does that synchronously inside the scroll handler, blocking the
   * frame. Measured on a 6x-throttled phone, dragging across three slides: worst frame 94ms with
   * this update urgent, 20ms with the handler removed entirely -- a visible hitch each time the
   * finger crosses into the next photograph, which is the whole of "the gallery does not scroll
   * smoothly".
   *
   * startTransition marks it interruptible, so React yields to the scroll and paints the new index
   * in the gaps instead of ahead of the frame. Nothing here needs to be synchronous: the index
   * drives a counter, the thumbnail highlight and the lighting wash, and none of the three has to
   * land in the same frame as the pixels moving under the finger.
   */
  const onRailScroll = (e) => {
    const el = e.currentTarget;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index && next >= 0 && next < images.length) {
      startTransition(() => setIndex(next));
    }
  };

  return (
    <>
      {/* ================================ DESKTOP MOSAIC ================================ */}
      <div
        ref={gridRef}
        style={{ top: `${stickyTop}px` }}
        // FLUSH (user, 2026-09-05). The tiles used to sit at gap-4 with a hairline and a radius
        // each, which framed eight photographs as eight cards. On a page selling a surface, the
        // photographs ARE the surface: butted together they read as one continuous sheet of the
        // material, which is the thing being judged. The frame moves to the block -- one border and
        // one radius around the whole mosaic, with overflow-hidden so the corner tiles clip to it.
        //
        // The hairline is now PER TILE, not one border round the block (user, 2026-10-19): with an
        // odd count the block's border also boxed the empty last cell, drawing a frame round nothing.
        // Each tile carries its own border and overlaps its neighbours by 1px (-ml-px/-mt-px,
        // offset by pl-px/pt-px here), so shared edges stay ONE hairline and an empty cell has none.
        className="sticky hidden grid-cols-2 gap-0 pl-px pt-px lg:grid"
      >
        {images.map((img, i) => (
          /*
            Each tile is WRAPPED rather than being the grid child itself, for one reason: the
            lighting trigger belongs in the corner of the FIRST photograph, and a <button> cannot
            legally contain another <button>. The wrapper gives the trigger something tile-shaped to
            position against -- against the grid it would land on the last tile in the mosaic
            instead, which reads as belonging to that photograph.
          */
          <div
            key={img.url}
            className={`relative -ml-px -mt-px border border-line ${solo ? "col-span-2" : ""}`}
          >
            <button
              type="button"
              onClick={() => show(i)}
              aria-label={`Enlarge image ${i + 1} of ${images.length}`}
              // No border or radius of its own -- the mosaic carries both now.
              className="group relative isolate block aspect-swatch w-full cursor-zoom-in overflow-hidden bg-paper"
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

      <GalleryLightbox
        open={open}
        onClose={() => setOpen(false)}
        images={images}
        index={index}
        onIndex={goto}
        title={title}
        lightingOn={lightingOpen}
        onToggleLighting={() => setLightingOpen((v) => !v)}
        onContainer={setLightboxEl}
      />
    </>
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
    <span className="pointer-events-none absolute left-0 top-0 z-10 rounded-br-sm bg-ink px-3 py-1.5 text-xs font-medium tracking-wide leading-none text-white">
      {children}
    </span>
  );
}
