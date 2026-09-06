import { Star } from "lucide-react";

import Stars from "./Stars";
import ReviewForm from "./ReviewForm";
import ReviewList from "./ReviewList";
import ReviewPhotos from "./ReviewPhotos";
import { jumpTo } from "@/utils/jumpTo";

/**
 * The reviews section, under the promises strip.
 *
 * MARKETPLACE ANATOMY (user's call, 2026-08-22, over a quieter editorial version): a solid summary
 * panel on the left -- big average, stars, count, the five bars, one CTA -- and the reviews
 * themselves as cards on the right, behind filter chips. It is the shape every Indian shopper
 * already knows from Amazon, Flipkart and Material Depot, and the reason it wins here is that the
 * hairline version read as a footnote to the page rather than a section of it.
 *
 * The one place it departs from the marketplace pattern is the SOLID FILL. §06 of the brand system
 * allows no shadows, so the panel is separated by a 1px rule and a white ground against the cream
 * page -- which is enough, because the bars inside it are the only quantity DRAWN anywhere on the
 * PDP and they carry the block on their own.
 *
 * A SERVER COMPONENT. page.js has already fetched the reviews, so they arrive in the HTML --
 * readable by Google, present with JavaScript off. Only the filter chips and the form are client
 * code, and even those server-render their initial markup.
 *
 * WHEN THERE ARE NO REVIEWS the panel is not rendered at all: a card built around a big "0.0" and
 * five empty bars is worse than no card, and an empty five-star row beside a real price is the
 * manufactured social proof this PDP refuses everywhere else.
 */
export default function ProductReviews({ summary, product }) {
  const { count = 0, average = 0, distribution = {}, reviews = [] } = summary ?? {};

  return (
    // scroll-mt clears the sticky header AND the desktop buy bar that covers it -- both rating
    // links in the buy box jump here, and without this the heading lands underneath them.
    <section id="reviews" className="container-main mt-8 scroll-mt-24 lg:mt-10">
      <h2 className="font-display text-lg tracking-[-0.02em] lg:text-xl">
        {count > 0 ? "What buyers say" : "Reviews"}
      </h2>

      {count === 0 ? (
        <div className="mt-4 max-w-xl">
          {/* The honest empty state. It does not pretend to be a feature, it asks for the thing
              that is missing -- and it says WHO it is asking, because a tile only gets reviewed
              months after it is laid and nobody expects otherwise. */}
          <p className="text-sm leading-relaxed text-subtle">
            Nobody has reviewed this one yet. If you’ve laid it, tell the next buyer how it went —
            how it looks in the room, how it cut, how the delivery was.
          </p>
          <div className="mt-4">
            <ReviewForm productGid={product.id} handle={product.handle} />
          </div>
        </div>
      ) : (
        <>
          <CustomerPhotos reviews={reviews} />

          <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:gap-8">
            {/* ============================ SUMMARY PANEL ============================ */}
            <div className="lg:col-span-4">
              <div className="rounded-sm border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  {/* The one large number on this half of the page. leading-none because at 40px the
                      font's own line box adds a third of a line of air above the stars beside it. */}
                  <p className="num text-4xl font-semibold leading-none text-ink">
                    {average.toFixed(1)}
                  </p>
                  <div>
                    <Stars value={average} size={16} />
                    <p className="num mt-1 text-xs text-subtle">
                      Based on {count} review{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {/* THE BREAKDOWN. Its job is to answer "is 4.3 four fives and a one, or five fours?"
                    -- a different question from the average, and the one that decides whether the
                    average is believed.

                    Bars in GOLD, not the action orange: they are the same quantity the stars above
                    them describe, and two warm hues in one small card fight.

                    Shown at ANY count, including one: a single filled bar is honest and keeps the
                    panel's shape, where hiding it below some threshold made the card look broken on
                    exactly the products that have just got their first review. */}
                <ul className="mt-5 space-y-1.5 border-t border-line pt-4">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = distribution[star] ?? 0;
                    return (
                      <li key={star} className="flex items-center gap-2.5 text-xs">
                        <span className="num w-2.5 text-right text-ink">{star}</span>
                        {/* ONE star as the unit marker, not <Stars> -- that component always draws
                            the full row of five, so shrinking it to a 12px box rendered five
                            overlapping stars where a single glyph was meant. */}
                        <Star
                          size={11}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="shrink-0 fill-gold text-gold-line"
                        />
                        <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-line">
                          <span
                            className="block h-full bg-gold"
                            style={{ width: `${(n / count) * 100}%` }}
                          />
                        </span>
                        <span className="num w-5 text-right text-subtle">{n}</span>
                      </li>
                    );
                  })}
                </ul>

                {/* The CTA, OUTLINED rather than filled. Orange is this store's action colour and it
                    is spent on Add to cart; a second solid orange button in the same viewport is two
                    primaries, and the one that matters would lose. */}
                <details className="group mt-5">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:bg-paper">
                    Write a review
                    <span className="text-subtle transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="mt-3">
                    <ReviewForm productGid={product.id} handle={product.handle} />
                  </div>
                </details>
              </div>
            </div>

            {/* ============================== THE REVIEWS ============================== */}
            <div className="lg:col-span-8">
              <ReviewList reviews={reviews} distribution={distribution} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- pieces */

/** Thumbnails before the "+N" tile takes over. Six fills the row at every breakpoint we use. */
const PHOTO_STRIP = 6;

/**
 * EVERY customer photograph on this product, pulled out of the individual reviews and shown as one
 * strip above them -- CaratLane's "Images by Customers (5)" block, and the single best idea in
 * their reviews section (audited 2026-08-22).
 *
 * It is worth MORE here than it is on a ring. A tile is bought to cover a room, and the one thing
 * no studio photograph can show is how the shade reads across forty square feet under somebody
 * else's lighting. Those pictures already existed in this data; they were just buried one review
 * deep, where the shopper has to read three opinions to find the second photograph.
 *
 * The thumbnails open the product gallery's own lightbox -- see ReviewPhotos for why the tab this
 * used to open was the wrong answer. The "+N" tile still is not a photograph: the rest are attached
 * to reviews and the useful thing to do with them is read what the person said, so it stays an
 * anchor into the list.
 */
function CustomerPhotos({ reviews }) {
  // Each photograph keeps the review it came from -- that pairing is what the overlay shows.
  const photos = reviews.flatMap((r) => r.photos.map((photo) => ({ ...photo, review: r })));
  if (photos.length === 0) return null;

  const strip = photos.slice(0, PHOTO_STRIP);
  const hidden = photos.length - strip.length;

  return (
    <div className="mt-4 border-b border-line pb-5">
      <p className="text-xs font-medium text-ink">
        Photos from buyers <span className="num text-subtle">({photos.length})</span>
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ReviewPhotos items={strip}>
          {hidden > 0 && (
            <a
              href="#reviews"
              onClick={jumpTo("reviews")}
              className="num flex h-20 w-20 items-center justify-center rounded-sm border border-line bg-surface text-sm font-medium text-subtle transition-colors hover:border-line-strong"
            >
              +{hidden}
            </a>
          )}
        </ReviewPhotos>
      </div>
    </div>
  );
}
