import Image from "next/image";
import { notFound } from "next/navigation";

import { articleDate } from "@/components/blog/ArticleCard";
import { getArticle, getArticles } from "@/lib/blog";

/**
 * One guide. The words and the markup come from Shopify's editor, so the body is styled by element
 * through `policy-prose` -- the same block the policy pages use, and for the same reason: there are
 * no classes in that HTML to hook.
 */
export const revalidate = 600;

export async function generateStaticParams() {
  const articles = await getArticles(50);
  return articles.map((a) => ({ handle: a.handle }));
}

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const article = await getArticle(handle);
  if (!article) return { title: "Guide not found" };

  return {
    title: article.seo?.title || `${article.title} | Material`,
    description: article.seo?.description || article.excerpt?.slice(0, 155),
  };
}

export default async function ArticlePage({ params }) {
  const { handle } = await params;
  const article = await getArticle(handle);

  if (!article) notFound();

  return (
    <main className="container-main mt-6 pb-20 lg:mt-10 lg:pb-28">
      <article className="mx-auto max-w-[68ch]">
        <header className="border-b border-line pb-5">
          <h1 className="font-display text-2xl tracking-[-0.02em] text-ink lg:text-3xl">
            {article.title}
          </h1>
          {article.publishedAt && (
            <p className="num mt-2 text-xs text-meta">{articleDate(article.publishedAt)}</p>
          )}
        </header>

        {article.image && (
          <Image
            src={article.image.url}
            alt={article.image.altText ?? ""}
            width={article.image.width ?? 1200}
            height={article.image.height ?? 800}
            sizes="(min-width: 1024px) 68ch, 100vw"
            className="mt-7 w-full rounded-sm border border-line"
            priority
          />
        )}

        {/* Markup we did not author. Shopify sanitises it server-side and only staff with admin
            access can write it -- the same trust boundary as the policy pages. */}
        <div className="policy-prose mt-7" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
      </article>
    </main>
  );
}
