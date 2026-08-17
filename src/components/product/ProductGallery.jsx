"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import "swiper/css";

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

export default function ProductGallery({ images, title, tag, wishlisted, onWishlist, onShare }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const swiperRef = useRef(null);
  const gridRef = useRef(null);
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
   * ONE sizes string per image, shared by the desktop mosaic and the mobile swiper below.
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
    swiperRef.current?.slideTo(next);
  };

  return (
    <>
      {/* ================================ DESKTOP MOSAIC ================================ */}
      <div
        ref={gridRef}
        style={{ top: `${stickyTop}px` }}
        className="sticky hidden grid-cols-2 gap-4 lg:grid"
      >
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => show(i)}
            aria-label={`Enlarge image ${i + 1} of ${images.length}`}
            className={`group relative aspect-swatch cursor-zoom-in overflow-hidden rounded-sm border border-line bg-paper ${
              solo ? "col-span-2" : ""
            }`}
          >
            <Image
              src={img.url}
              alt={img.altText || (i === 0 ? title : "")}
              fill
              // The SAME sizes as the mobile block below, so both request an identical URL and the
              // hidden-but-rendered copy costs nothing. They diverged before this, which made a
              // desktop load fetch every photograph twice.
              sizes={sizesFor()}
              priority={i < 2}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </button>
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
          <Swiper
            slidesPerView={1}
            onSwiper={(s) => (swiperRef.current = s)}
            onSlideChange={(s) => setIndex(s.activeIndex)}
            className="aspect-swatch w-full"
          >
            {images.map((img, i) => (
              <SwiperSlide key={img.url}>
                <button
                  type="button"
                  onClick={() => show(i)}
                  aria-label={`Enlarge image ${i + 1} of ${images.length}`}
                  className="relative block h-full w-full bg-paper"
                >
                  <Image
                    src={img.url}
                    alt={img.altText || (i === 0 ? title : "")}
                    fill
                    sizes={sizesFor()}
                    priority={i === 0}
                    className="object-cover"
                  />
                </button>
              </SwiperSlide>
            ))}
          </Swiper>

          {tag && <Tag>{tag}</Tag>}
          <Controls
            wishlisted={wishlisted}
            onWishlist={onWishlist}
            onShare={onShare}
            title={title}
          />

          {images.length > 1 && (
            <span className="num absolute bottom-3 right-3 z-10 rounded-sm bg-surface/60 px-2 py-0.5 text-[11px] text-ink backdrop-blur-md">
              {index + 1}/{images.length}
            </span>
          )}
        </div>

        {/* Thumbnail strip, theirs. A scroll rail of buttons driving the Swiper above rather than
            a second Swiper with the Thumbs module: same behaviour, one instance. */}
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
                  <Image src={img.url} alt="" fill sizes="56px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Lightbox
        open={open}
        onOpenChange={setOpen}
        images={images}
        index={index}
        onIndex={goto}
        title={title}
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
function Lightbox({ open, onOpenChange, images, index, onIndex, title }) {
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
        aria-describedby={undefined}
        className="h-dvh w-screen max-w-none gap-0 rounded-none border-0 bg-ink/95 p-0 text-white sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative flex h-full w-full items-center justify-center">
          <div
            onClick={toggleZoom}
            className={`relative h-full w-full ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          >
            <Image
              src={image.url}
              alt={image.altText || title}
              fill
              sizes="100vw"
              className="transition-transform duration-300"
              style={{
                objectFit: "contain",
                transform: zoom ? "scale(2.5)" : "scale(1)",
                transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
              }}
            />
          </div>

          {images.length > 1 && (
            <>
              <ArrowButton side="left" onClick={() => onIndex(index - 1)} />
              <ArrowButton side="right" onClick={() => onIndex(index + 1)} />
              <span className="num absolute bottom-5 left-1/2 -translate-x-1/2 rounded-sm bg-surface/80 px-2.5 py-1 text-xs text-ink">
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
