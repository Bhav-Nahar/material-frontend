import { notFound } from "next/navigation";

import { getPage, getPageHandles } from "@/lib/pages";

/**
 * Policy and information pages. The words come from Shopify; the typography is ours.
 *
 * The body arrives as HTML written in Shopify's rich-text editor, so it is styled by ELEMENT rather
 * than by class -- there are no classes to hook. That is what the `prose` block below is for, and
 * it is why the styles live here rather than in a component: this is the only place in the app that
 * renders markup it did not author.
 */
export const revalidate = 600;

export async function generateStaticParams() {
  // Pre-render whatever is published at build time; anything added later is rendered on demand.
  const handles = await getPageHandles();
  return handles.map((handle) => ({ handle }));
}

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const page = await getPage(handle);
  if (!page) return { title: "Page not found" };

  return {
    title: page.seo?.title || `${page.title} | Texture House`,
    description: page.seo?.description || page.bodySummary?.slice(0, 155),
  };
}

const updated = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default async function PolicyPage({ params }) {
  const { handle } = await params;
  const page = await getPage(handle);

  // Covers both "no such page" and "written but not published yet" -- the Storefront API returns
  // null for each, and neither should render.
  if (!page) notFound();

  return (
    <main className="container-main mt-6 pb-20 lg:mt-10 lg:pb-28">
      <article className="mx-auto max-w-[68ch]">
        <header className="border-b border-line pb-5">
          <h1 className="font-display text-2xl tracking-[-0.02em] text-ink lg:text-3xl">
            {page.title}
          </h1>
          {page.updatedAt && (
            <p className="num mt-2 text-xs text-meta">Last updated {updated(page.updatedAt)}</p>
          )}
        </header>

        {/* The one place in this app that renders markup it did not write. Shopify sanitises the
            body server-side, and only staff with admin access can author it. */}
        <div
          className="policy-prose mt-7"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
      </article>
    </main>
  );
}
