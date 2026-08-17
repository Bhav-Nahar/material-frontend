import { Plus } from "lucide-react";

/**
 * A list of questions that open. Lifted out of HomeFaqs when /pages/faqs needed the same thing --
 * two copies of an accordion is two copies that drift.
 *
 * Still zero JavaScript: <details> has done open/close state, keyboard behaviour, screen-reader
 * roles and findable-in-page text for years, and none of that needs a useState.
 *
 * `answer` is a node, so the homepage can pass text plus a link and the FAQ page can pass a div of
 * Shopify HTML. That is the whole reason this takes children-ish props rather than strings.
 */
export default function FaqAccordion({ items }) {
  if (!items?.length) return null;

  return (
    <ul className="border-t border-line">
      {items.map((faq) => (
        <li key={faq.question} className="border-b border-line">
          {/* `group` sits on the details so the marker can read the open state off it. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-3 text-sm font-medium text-ink marker:hidden lg:py-4 lg:text-base [&::-webkit-details-marker]:hidden">
              {faq.question}
              {/* One icon, rotated 45° into a cross when open -- no second glyph to keep in step,
                  and it animates where swapping + for - cannot. */}
              <Plus
                size={18}
                strokeWidth={1.5}
                aria-hidden
                className="mt-0.5 shrink-0 text-subtle transition-transform duration-200 group-open:rotate-45"
              />
            </summary>

            {/* Capped at ~62 characters. Unconstrained, an answer ran the full 1,000px of the right
                column, which is roughly twice the line length anyone reads comfortably. */}
            <div className="max-w-[62ch] pb-5 text-sm leading-relaxed text-subtle">
              {faq.answer}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
