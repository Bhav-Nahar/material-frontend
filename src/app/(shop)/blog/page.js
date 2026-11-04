import { notFound } from "next/navigation";

import ArticleCard from "@/components/blog/ArticleCard";
import { getArticles } from "@/lib/blog";

export const revalidate = 600;

export const metadata = {
  title: "Guides | Texture House",
  description: "How to choose, measure and lay tiles, laminates and wallpaper.",
};

export default async function BlogIndex() {
  const articles = await getArticles(24);

  // Nothing published yet: 404 rather than an empty page with a heading over white space. The
  // footer and homepage hide their links for the same reason, so this is only reachable by typing
  // the URL.
  if (articles.length === 0) notFound();

  return (
    <main className="container-main mt-6 pb-20 lg:mt-10 lg:pb-28">
      <h1 className="font-display text-2xl tracking-[-0.02em] text-ink lg:text-3xl">Guides</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-meta">
        What to buy, how much of it, and what the numbers on the box actually mean.
      </p>

      <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {articles.map((article) => (
          <li key={article.handle}>
            <ArticleCard article={article} />
          </li>
        ))}
      </ul>
    </main>
  );
}
