import { notFound } from "next/navigation";

import FaqAccordion from "@/components/faq/FaqAccordion";
import { getPage, parseFaqSections } from "@/lib/pages";

/**
 * The FAQ page, which is the one policy page nobody reads top to bottom.
 *
 * The other seven render through /pages/[handle] as continuous prose, which is right for a returns
 * policy someone reads once with a problem in front of them. Sixty questions read that way is a
 * wall, so this route takes the same Shopify body and re-renders it as the homepage's accordion --
 * closed by default, so the section headings do the navigating.
 *
 * A static segment beats the dynamic [handle] one in Next's router, so this file simply wins for
 * /pages/faqs and nothing had to be excluded from the other route.
 */
export const revalidate = 600;

export async function generateMetadata() {
  const page = await getPage("faqs");
  if (!page) return { title: "Page not found" };

  return {
    title: page.seo?.title || `${page.title} | Material`,
    description: page.seo?.description || page.bodySummary?.slice(0, 155),
  };
}

export default async function FaqsPage() {
  const page = await getPage("faqs");
  if (!page) notFound();

  const { lead, sections } = parseFaqSections(page.body);

  return (
    <main className="container-main mt-6 pb-20 lg:mt-10 lg:pb-28">
      <header className="mx-auto max-w-[68ch] border-b border-line pb-5">
        <h1 className="font-display text-2xl tracking-[-0.02em] text-ink lg:text-3xl">
          {page.title}
        </h1>
        {lead && (
          <div
            className="policy-prose mt-3 text-sm text-subtle"
            dangerouslySetInnerHTML={{ __html: lead }}
          />
        )}
      </header>

      <div className="mx-auto mt-8 max-w-[68ch] space-y-10 lg:mt-12 lg:space-y-14">
        {sections.map((section) => (
          <section key={section.heading} aria-labelledby={`faq-${section.heading}`}>
            <h2
              id={`faq-${section.heading}`}
              className="text-base font-medium text-ink lg:text-lg"
            >
              {section.heading}
            </h2>

            {/* The last section is a closing paragraph rather than questions -- it has an intro and
                no items, and falls through to prose. */}
            {section.intro && (
              <div
                className="policy-prose mt-2 text-sm text-subtle"
                dangerouslySetInnerHTML={{ __html: section.intro }}
              />
            )}

            <div className="mt-4">
              <FaqAccordion
                items={section.items.map((item) => ({
                  question: item.question,
                  answer: (
                    <div
                      className="policy-prose"
                      dangerouslySetInnerHTML={{ __html: item.answer }}
                    />
                  ),
                }))}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
