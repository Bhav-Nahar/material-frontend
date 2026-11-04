import Link from "next/link";
import FaqAccordion from "@/components/faq/FaqAccordion";
import { HOME_FAQS } from "@/data/faqs";
import { WHATSAPP_NUMBER } from "@/data/footer";
import { buildWhatsappLink } from "@/lib/whatsapp";

/**
 * Homepage FAQs. The jewelry build's HomeFAQSection layout -- heading in a narrow left column, the
 * accordion filling a wider right one -- with its implementation thrown away.
 *
 * The accordion itself is <FaqAccordion>, shared with /pages/faqs. The jewelry build's is a client
 * component holding an openIndex in useState and animating height with framer-motion; ours ships
 * zero JavaScript, which on the last section of a long homepage is the whole argument.
 *
 * The jewelry build's right-hand column is a photograph. Ours is not: the page already repeats the
 * same three studio shots five times over, and a sixth would be the most tired one yet. The heading
 * column carries a line of prose instead.
 *
 * ponytail: no FAQPage JSON-LD. Google restricted FAQ rich results to government and health sites
 * in 2023, so the schema no longer earns a shop anything -- it is markup that only ever paid for
 * itself in the SERP.
 */
export default function HomeFaqs() {
  if (HOME_FAQS.length === 0) return null;

  return (
    <section aria-labelledby="home-faqs" className="container-main pb-4">
      {/* A FIXED narrow left column, not a fraction of the width. At 1fr_1.7fr the heading got a
          500px column to hold three lines of text and left 400px of blank paper under it. The
          accordion takes everything that is left over instead.

          Sticky so the heading rides alongside the questions once the list outgrows the viewport --
          it is `self-start` because a stretched grid item cannot stick. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="home-faqs" className="text-xl lg:text-2xl">
            Questions we get asked
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-subtle">
            Mostly about quantities, freight and what happens when a box turns up cracked.
          </p>
          {/* Was the words "ask us on WhatsApp" with nothing behind them -- a dead end at the exact
              moment someone has a question the list does not answer. */}
          {WHATSAPP_NUMBER && (
            <a
              href={buildWhatsappLink(WHATSAPP_NUMBER, ["Hi Texture House, I have a question."])}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-action-ink underline decoration-line-strong underline-offset-4 hover:decoration-current"
            >
              Ask us on WhatsApp
            </a>
          )}
        </div>

        {/* The answer is a node, not a string, so the optional read-more link rides inside it. */}
        <FaqAccordion
          items={HOME_FAQS.map((faq) => ({
            question: faq.question,
            answer: (
              <>
                {faq.answer}
                {faq.link && (
                  <Link
                    href={faq.link.href}
                    prefetch={false}
                    className="mt-2 block font-medium text-action-ink underline decoration-line-strong underline-offset-4 hover:decoration-current"
                  >
                    {faq.link.text}
                  </Link>
                )}
              </>
            ),
          }))}
        />
      </div>
    </section>
  );
}
