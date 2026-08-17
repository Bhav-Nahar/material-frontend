import Image from "next/image";
import Link from "next/link";

/**
 * One guide, as a card. Used by the /blog index and by the homepage strip, so the two cannot drift.
 *
 * ponytail: no author, no read time, no tag pills. Shopify has fields for all three; none of them
 * change whether the guide gets clicked. Add one when someone asks for it by name.
 */
export const articleDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/**
 * `oneLineTitle` is for the homepage strip, where four cards sit in a row and a title that wraps to
 * two lines pushes its summary and date out of line with its neighbours. On /blog the titles wrap
 * in full -- that page is a list to read, not a row to scan, and a truncated title there is just a
 * question the reader has to click to answer.
 */
export default function ArticleCard({ article, oneLineTitle = false }) {
  return (
    <Link href={`/blog/${article.handle}`} prefetch={false} className="group block">
      {/* Shopify lets an article be published with no image. The bordered ground stands in, rather
          than the card collapsing to text and breaking the grid's rhythm. */}
      <span className="relative block aspect-swatch overflow-hidden rounded-sm border border-line bg-surface">
        {article.image && (
          <Image
            src={article.image.url}
            alt={article.image.altText ?? ""}
            fill
            sizes="(min-width: 1024px) 300px, 45vw"
            className="object-cover"
          />
        )}
      </span>

      <h3
        className={`mt-3 text-sm text-ink underline-offset-4 group-hover:underline lg:text-base ${
          // Every width, phone included (user's call, asked for twice). The row stays level, at the
          // cost of a hard truncation on a 2-up phone grid -- "Choosing a laminate: thickness,
          // finish..." becomes "Choosing a...". The summary line underneath carries the sense.
          oneLineTitle ? "line-clamp-1" : ""
        }`}
      >
        {article.title}
      </h3>

      {/* The summary written in Shopify, clamped to two lines. A title alone makes the reader open
          a guide to find out whether it answers their question; two lines usually settles it. */}
      {article.excerpt && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-meta lg:text-sm">
          {article.excerpt}
        </p>
      )}

      {article.publishedAt && (
        <p className="num mt-1.5 text-xs text-meta">{articleDate(article.publishedAt)}</p>
      )}
    </Link>
  );
}
