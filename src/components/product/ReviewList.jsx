"use client";

import { useState } from "react";

import ReviewPhotos from "./ReviewPhotos";
import { BadgeCheck, ImageIcon, Star } from "lucide-react";

import Stars from "./Stars";

/**
 * The reviews themselves, with the filter chips above them.
 *
 * "use client" FOR THE CHIPS, AND IT COSTS NO SEO. A client component still server-renders its
 * initial HTML, so every review is in the document Google reads and in find-in-page; the JavaScript
 * only takes over when someone taps a chip. The alternative -- filtering through the URL -- would
 * re-render the whole PDP (product, rails, schema) to hide four cards, and put a ?rating=5 on a
 * canonical product URL.
 *
 * The chips filter what is ALREADY HERE rather than refetching: lib/reviews.js brings back the
 * product's whole review set in one request, so every filter is instant and works offline.
 *
 * ponytail: one useState. No sort control -- newest-first is the order people want and a second
 * control next to the chips is two things to reason about. No "was this helpful?" voting either:
 * judge.me's free plan has no vote endpoint, and a count nobody can increment is furniture.
 */

/** Reviews shown before "show more". Four fills the column beside the summary panel. */
const SHOWN = 4;

export default function ReviewList({ reviews, distribution }) {
  // null = everything. A number = that star only. "photos" = has at least one picture.
  const [filter, setFilter] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const withPhotos = reviews.filter((r) => r.photos.length > 0).length;

  const shown =
    filter === null
      ? reviews
      : filter === "photos"
        ? reviews.filter((r) => r.photos.length > 0)
        : reviews.filter((r) => r.rating === filter);

  const visible = expanded ? shown : shown.slice(0, SHOWN);

  /**
   * Which chips exist at all. A chip that would return nothing is a dead control -- worse than
   * absent, because tapping it is the moment the shopper decides the filters are broken. So the
   * star chips come from the DISTRIBUTION (only ratings somebody actually gave) and the photo chip
   * only appears when a photograph exists.
   */
  const chips = [
    { key: null, label: "All", n: reviews.length },
    ...[5, 4, 3, 2, 1]
      .filter((star) => (distribution[star] ?? 0) > 0)
      .map((star) => ({ key: star, label: star, n: distribution[star], star: true })),
    ...(withPhotos > 0
      ? [{ key: "photos", label: "With photos", n: withPhotos, photo: true }]
      : []),
  ];

  /**
   * Is there anything to filter? A chip earns its place only if tapping it shows FEWER reviews than
   * "All" does. On a product with one review the row was rendering [All 1] [4★ 1] -- two controls
   * for one identical set, which is how a shopper learns the filters do nothing. Same for a product
   * whose every review happens to be five stars, and for the photo chip when every review has one.
   */
  const filterable = chips.slice(1).some((chip) => chip.n < reviews.length);

  return (
    <div>
      {/* Scrolls sideways on a phone rather than wrapping to three rows: with five ratings and a
          photo chip this row is wider than 390px, and a stack of chip rows pushes the first review
          off the screen. no-scrollbar is the site's own utility -- see globals.css. */}
      <div
        className={`no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${
          filterable ? "" : "hidden"
        }`}
      >
        {chips.map((chip) => {
          const active = filter === chip.key;
          return (
            <button
              key={String(chip.key)}
              type="button"
              onClick={() => {
                setFilter(chip.key);
                // Collapse on every change. Keeping "show all" on across filters meant switching
                // from All to 5★ left a 12-review column showing seven, with no control to close it.
                setExpanded(false);
              }}
              aria-pressed={active}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? // Charcoal fill for the selected chip, not orange: orange is the action colour
                    // and a filter is a view, not an action. Same call SpecChips makes.
                    "border-ink bg-ink text-white"
                  : "border-line bg-surface text-subtle hover:border-line-strong"
              }`}
            >
              {chip.label}
              {chip.star && (
                <Star
                  size={11}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  // Inherits the chip's own colour: gold on a charcoal active chip would be a
                  // third colour in a control, and the chip is a filter, not a rating.
                  className="fill-current"
                />
              )}
              {chip.photo && <ImageIcon size={11} strokeWidth={1.5} aria-hidden="true" />}
              <span className="num opacity-60">{chip.n}</span>
            </button>
          );
        })}
      </div>

      <ul className={`space-y-3 ${filterable ? "mt-3" : ""}`}>
        {visible.map((review) => (
          <Review key={review.id} review={review} />
        ))}
      </ul>

      {/* One control, two labels. It says how many are left rather than "Show more", because the
          decision to keep reading depends on whether that is two more or forty. */}
      {shown.length > SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-3 w-full cursor-pointer rounded-sm border border-line bg-surface px-4 py-3 text-xs font-medium text-ink transition-colors hover:border-line-strong"
        >
          {expanded
            ? "Show fewer reviews"
            : `Read ${shown.length - SHOWN} more review${shown.length - SHOWN === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- pieces */

function Review({ review }) {
  return (
    <li className="rounded-sm border border-line bg-surface p-4">
      <div className="flex gap-3">
        {/* An initial, not a photograph -- judge.me carries no avatar and a generic silhouette on
            every row is decoration pretending to be identity. rounded-full is the one shape §06
            exempts from the 2px radius, for exactly this.

            NEUTRAL cream, not the accent wash it started as: beside gold stars a peach disc was a
            second warm hue competing with the only one in this card that carries meaning. The disc
            anchors the row's left edge and is otherwise meant to be unnoticed. */}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-sm font-semibold text-subtle"
        >
          {review.name.trim().charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-sm font-medium text-ink">{review.name}</span>
            {review.verified && (
              // Only ever rendered for judge.me's "buyer" state -- see the note in lib/reviews.js.
              // A verified badge is the shop vouching for the review, so it is worth being strict.
              <span className="flex items-center gap-1 text-[11px] text-good">
                <BadgeCheck size={12} strokeWidth={1.75} />
                Verified purchase
              </span>
            )}
            {review.createdAt && (
              <time dateTime={review.createdAt} className="num ml-auto text-[11px] text-meta">
                {formatDate(review.createdAt)}
              </time>
            )}
          </div>

          {/* The stars AND the figure, CaratLane's row (audited 2026-08-22): they print a small
              gold row then "5/5" beside it. The redundancy earns its place -- five small stars at
              13px are read as "good" rather than counted, and the fraction is what someone
              comparing two reviews in the same column actually reads. */}
          <div className="mt-1 flex items-center gap-2">
            <Stars value={review.rating} size={13} />
            <span className="num text-[11px] font-medium text-subtle">{review.rating}/5</span>
          </div>

          {review.title && <p className="mt-2 text-sm font-medium text-ink">{review.title}</p>}
          {review.body && <Body text={review.body} />}

          {/* Customer photographs -- for a tile the single most useful thing in a review, because a
              studio shot cannot show how a floor reads under someone's own lighting.

              They open the product gallery's lightbox, paging across this review's own photographs
              -- see ReviewPhotos. */}
          {review.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ReviewPhotos
                items={review.photos.map((photo) => ({ ...photo, review }))}
                size="h-16 w-16"
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Past this many characters a review gets a "Read more" instead of its full height. */
const LONG = 260;

/**
 * A review body, truncated if it runs long -- CaratLane clamps theirs to two lines behind a "Read
 * more" (audited 2026-08-22), and the reason is the column, not the prose: one person who writes
 * four paragraphs about their delivery pushes every other review off the screen, and the value of
 * this list is being able to scan several opinions.
 *
 * CLAMPED BY CHARACTER COUNT, not by line-clamp alone. A CSS clamp still ships the whole string and
 * renders a "Read more" under reviews that were never truncated -- a control that does nothing,
 * which is the same fault the filter chips had. The threshold is generous: at 260 characters a
 * review has already said what it came to say, and short ones are untouched.
 */
function Body({ text }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG;

  return (
    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-subtle">
      {long && !open ? `${clip(text)}…` : text}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-1.5 cursor-pointer text-xs font-medium text-action-ink underline-offset-4 hover:underline"
        >
          {open ? "Read less" : "Read more"}
        </button>
      )}
    </p>
  );
}

/**
 * Cut to the last whole word before the limit, then drop any trailing punctuation.
 *
 * Both halves are there because of what the naive `slice(0, LONG)` produced. Cutting mid-word left
 * "the matte fin…", which reads as a rendering fault rather than a truncation; and when the cut
 * happened to land just after a full stop the ellipsis stacked onto it as "flat did.…", which
 * renders as four dots.
 */
function clip(text) {
  const cut = text.slice(0, LONG);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > LONG * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?…-]+$/u, "");
}

/** "Aug 2026". A day number on a review written four months after delivery buys nothing. */
function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
