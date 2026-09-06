"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { BadgeCheck, ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Customer photographs, and the review each one came with.
 *
 * THEY USED TO OPEN A TAB, behind a note that read "no lightbox -- the full size opens in a tab,
 * which is what a browser is for. A modal gallery with keyboard paging and focus trapping is a
 * component; this is an <a>." Right when written, wrong now (user, 2026-09-05): a new tab is a dead
 * end. It drops the shopper on a bare judge.me image with no way back but the tab bar, no next
 * photograph, and on a phone a chrome change that reads as having left the shop. Comparing these
 * pictures against each other is the entire reason they are on the page.
 *
 * THE SHAPE IS CARATLANE'S (audited 2026-09-05, user asked for theirs). Their review zoom is not a
 * zoom: it is a split panel, photograph one side and that reviewer's rating, name, date, verified
 * badge and text on the other, and the arrow pages through photographs carrying each one's review
 * with it. Confirmed by walking it -- next moved from one reviewer to another, panel and all.
 *
 * That settles a compromise the strip in ProductReviews had already made. Its "+N" tile goes to the
 * LIST rather than opening an image, on the grounds that the useful thing to do with a customer
 * photo is read what the person said about it. This refuses to make that a choice. A photograph of
 * somebody's floor is evidence; whose floor, how they rated it and whether they actually bought it
 * is what makes it evidence rather than decoration -- and on a tile, where the whole question is
 * how a shade reads in a real room under real light, the room's owner IS the caption.
 *
 * WHAT IS NOT COPIED. Their POSITIVES chips (DESIGN, SIZE/FIT, QUALITY, PACKAGING...) are
 * structured aspect ratings collected at review time; judge.me returns no such field, so there is
 * nothing here to fill them with and inferring them from prose would be inventing the data. Their
 * type, colour and spacing are not copied either -- this is the pattern in our own tokens.
 *
 * RADIX DIALOG, NOT THE LIGHTBOX LIBRARY. yet-another-react-lightbox owns its own layout; a fixed
 * text panel beside the slide is the one thing it does not hand over, and the captions plugin can
 * only put words over the picture. Dialog gives the focus trap, the scroll lock and Escape, and
 * leaves the layout to us -- which here is the entire point. Zoom goes with it: these are phone
 * snapshots served at judge.me's `compact` size, so there is nothing to magnify into.
 */
export default function ReviewPhotos({ items, size = "h-20 w-20", children }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (step) => setIndex((i) => (i + step + items.length) % items.length),
    [items.length],
  );

  /* Arrow keys, because a gallery that pages on click and not on ← → is a gallery that half-works.
     Radix already owns Escape and the focus trap. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (items.length === 0) return null;

  const current = items[index];
  const review = current?.review;

  return (
    <>
      {items.map(({ thumb }, i) => (
        <button
          key={`${thumb}-${i}`}
          type="button"
          onClick={() => {
            setIndex(i);
            setOpen(true);
          }}
          aria-label={`Open customer photo ${i + 1} of ${items.length}`}
          className="block cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image runs the Shopify CDN
              loader here (next.config.mjs) and would 404 on a judge.me URL. Already thumbnails. */}
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className={`${size} rounded-sm border border-line object-cover transition-opacity hover:opacity-90`}
          />
        </button>
      ))}

      {/* Whatever the caller wants after the thumbnails -- the strip's "+N" tile. */}
      {children}

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-200 bg-[rgba(28,27,25,0.96)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />

          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-200 flex items-center justify-center p-0 focus:outline-none lg:p-8"
          >
            <DialogPrimitive.Title className="sr-only">
              Customer photo {index + 1} of {items.length}
            </DialogPrimitive.Title>

            {/* STACKED ON A PHONE, SPLIT FROM lg. Theirs is a desktop split; a 380px text column
                beside a photograph on a 390px screen is two unreadable columns, so below lg the
                picture takes the width and the review sits under it. */}
            {/* A DEFINITE HEIGHT on desktop, not h-auto: the row is as tall as its tallest child, and
                a two-line review made that the text panel -- so the photograph got a 170px letterbox
                on a 900px screen. The picture is the reason the overlay opened; it sets the height
                and the words fit around it. Capped at 660 so a tall monitor does not blow a phone
                snapshot up past its own resolution. */}
            <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-surface lg:h-[min(86vh,660px)] lg:flex-row lg:rounded-sm">
              {/* THE PHOTOGRAPH. object-contain on ink: a customer's snapshot is any aspect ratio,
                  and cropping to fill would cut the floor out of a picture of a floor. */}
              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[rgb(28,27,25)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- judge.me URL, see above */}
                <img
                  key={current.full}
                  src={current.full}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />

                {items.length > 1 && (
                  <>
                    <PageButton side="left" onClick={() => go(-1)}>
                      <ChevronLeft size={20} strokeWidth={2} />
                    </PageButton>
                    <PageButton side="right" onClick={() => go(1)}>
                      <ChevronRight size={20} strokeWidth={2} />
                    </PageButton>
                  </>
                )}

                <p className="num absolute bottom-3 left-1/2 -translate-x-1/2 rounded-sm bg-black/55 px-2 py-0.5 text-[11px] text-white">
                  {index + 1} / {items.length}
                </p>
              </div>

              {/* THE REVIEW. Scrolls on its own so a long one cannot push the photograph around. */}
              <div className="min-h-0 shrink-0 overflow-y-auto border-t border-line p-5 lg:w-[360px] lg:border-l lg:border-t-0 lg:p-6">
                {review ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="num flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-surface">
                        {review.rating}
                        <span aria-hidden="true">★</span>
                      </span>
                      <p className="min-w-0 truncate text-sm font-semibold text-ink">
                        {review.name}
                      </p>
                      {review.createdAt && (
                        <time
                          dateTime={review.createdAt}
                          className="num ml-auto shrink-0 text-[11px] text-meta"
                        >
                          {formatDate(review.createdAt)}
                        </time>
                      )}
                    </div>

                    {review.verified && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-[11px] font-medium text-subtle">
                        <BadgeCheck size={12} strokeWidth={2} className="text-success" />
                        Verified purchase
                      </p>
                    )}

                    {review.title && (
                      <p className="mt-3 text-sm font-semibold text-ink">{review.title}</p>
                    )}

                    {/* NO "Read More". Theirs truncates to about three lines and hides the rest
                        behind a second click, inside an overlay whose whole job is one review. The
                        panel scrolls; there is nowhere for the rest of it to need to go. */}
                    {review.body && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-subtle">
                        {review.body}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-subtle">Photo from a buyer</p>
                )}
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-sm bg-black/55 text-white transition-colors hover:bg-black/75 lg:right-5 lg:top-5"
            >
              <X size={18} strokeWidth={2} />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/** The paging arrows, over the photograph rather than beside it -- there is no room beside it. */
function PageButton({ side, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70 ${
        side === "left" ? "left-2 lg:left-4" : "right-2 lg:right-4"
      }`}
    >
      {children}
    </button>
  );
}

/** "Aug 2026", the same shape ReviewList uses so the overlay and the list never disagree. */
function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
