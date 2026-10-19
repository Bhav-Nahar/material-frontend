"use client";

import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";

import ReviewForm from "./ReviewForm";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The way into writing a review, and the panel the form lives in.
 *
 * It used to BE the form: with no reviews, the whole thing -- stars, name, email, headline, body,
 * photos, an orange button -- sat open on the page, 666px tall across half the width, reading as a
 * raw form rather than a section (user, 2026-10-19). CaratLane's empty state is one slim row:
 * five empty stars, "Rate Us", a line under it, and a button on the right. This is that row, and
 * the form moves into a sheet -- from the right on desktop, from the bottom on a phone.
 *
 *   mode="empty"   the row, for a product nobody has reviewed. Tapping a star opens the sheet with
 *                  that rating already chosen, so the first decision is made in one tap.
 *   mode="button"  just the outlined button, for the summary panel once reviews exist.
 *
 * The form itself is unchanged -- same validation, same photo upload, same POST.
 */
export default function ReviewComposer({ productGid, handle, title, image, mode = "button" }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  // Remount the form per opening, so the star tapped on the row is the one it starts with.
  const [opened, setOpened] = useState(0);
  const desktop = useMediaQuery("(min-width: 1024px)");

  const start = (stars = 0) => {
    setRating(stars);
    setOpened((n) => n + 1);
    setOpen(true);
  };

  const button = (
    <button
      type="button"
      onClick={() => start()}
      className="cursor-pointer rounded-sm border border-line-strong bg-surface px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-ink"
    >
      Write a review
    </button>
  );

  return (
    <>
      {mode === "empty" ? (
        <div className="flex flex-col gap-4 rounded-sm border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => start(n)}
                    onMouseEnter={() => setHover(n)}
                    aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                    className="cursor-pointer p-0.5"
                  >
                    <Star
                      size={22}
                      strokeWidth={1.25}
                      aria-hidden="true"
                      className={`transition-colors ${n <= hover ? "fill-gold text-gold-line" : "text-line-strong"}`}
                    />
                  </button>
                ))}
              </div>
              <p className="font-display text-lg tracking-[-0.02em] text-ink">Rate this product</p>
            </div>
            <p className="mt-1.5 text-sm text-subtle">
              No reviews yet. Bought it? Tell the next buyer how it looks in the room and how
              delivery went.
            </p>
          </div>
          <div className="shrink-0">{button}</div>
        </div>
      ) : (
        <div className="[&>button]:w-full">{button}</div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={desktop ? "right" : "bottom"}
          // Radix focuses the first control -- the 1-star radio -- and its focus ring reads as "you
          // chose one star". With a rating already picked the next thing to do is the name; with
          // none, it is the rating, so focus the stars' group instead of star one specifically.
          // On a phone, focusing a field throws the keyboard up over the form before it has been
          // read -- so there, nothing is focused until the shopper taps.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            if (!desktop) return;
            const el = e.currentTarget;
            // The first thing still to do: a signed-in customer's name and email are already
            // filled (ReviewForm), so for them that is the review itself.
            const next = [...el.querySelectorAll("#review-name, #review-email, #review-body")].find((f) => !f.value);
            (rating ? next : el.querySelector('input[name="rating"]'))?.focus({
              preventScroll: true,
            });
          }}
          className={
            desktop
              ? "w-full overflow-y-auto sm:max-w-md"
              : "max-h-[90dvh] overflow-y-auto rounded-t-lg"
          }
        >
          <div className="px-5 pb-6 pt-5 lg:px-6">
            <div className="flex items-center gap-3 border-b border-line pb-4 pr-8">
              {image && (
                <Image
                  src={image}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-sm object-cover"
                />
              )}
              <div className="min-w-0">
                <SheetTitle className="font-display text-base tracking-[-0.02em] text-ink">
                  Review this product
                </SheetTitle>
                <p className="truncate text-xs text-subtle">{title}</p>
              </div>
            </div>
            <div className="mt-5">
              <ReviewForm
                key={opened}
                productGid={productGid}
                handle={handle}
                initialRating={rating}
                plain
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
