import Link from "next/link";

import ArticleCard from "@/components/blog/ArticleCard";
import { getArticles } from "@/lib/blog";

/**
 * The four newest guides, on the homepage. Same card and same grid as /blog, so the strip is a
 * window onto that page rather than a second design of it.
 *
 * Renders NOTHING until something is published -- like every other block on this page that reads
 * from Shopify, an empty source is an absent section, not an empty one.
 */
export default async function Guides({ limit = 4 }) {
  // A day, matching the rest of the homepage -- see the note on getArticles.
  const articles = await getArticles(limit, 86400);
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="home-guides" className="container-main pb-6">
      <div className="mb-6 flex items-end justify-between lg:mb-8">
        <h2 id="home-guides" className="text-xl lg:text-2xl">
          Guides
        </h2>
        <Link
          href="/blog"
          prefetch={false}
          className="text-sm text-meta underline-offset-4 hover:text-ink hover:underline"
        >
          See all
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {articles.map((article) => (
          <li key={article.handle}>
            <ArticleCard article={article} oneLineTitle />
          </li>
        ))}
      </ul>
    </section>
  );
}
