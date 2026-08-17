import { Phone } from "lucide-react";

import WhatsappIcon from "@/components/common/WhatsappIcon";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { FOOTER_CONTACT, WHATSAPP_NUMBER } from "@/data/footer";

/**
 * "Have a question? We are here to help" -- Material Depot's block, including the part that matters
 * most and that this site was hiding: THE PHONE NUMBER, in full, on the product page.
 *
 * A floor is a ₹25,000-plus order placed on trust, and in this market that trust is closed on a
 * call or on WhatsApp, not in a checkout. Depot prints the number on every PDP. Ours was buried in
 * the footer, five sections below the buy box.
 *
 * WHERE IT SITS: between the insight cards and the collapsible detail, not after them. The cards and
 * the identifier strip are as much as most people read, so "do I understand this well enough to buy
 * it?" gets asked right there -- and for anyone whose answer is no, the useful reply is a phone
 * number, offered before they either commit to five panels of reading or leave. Underneath the panels
 * it was only found by people who had already read past needing it.
 *
 * It REPLACES HelpMeChoose on the PDP rather than joining it. That band asks "tell us about your
 * space" and belongs on the homepage, where someone is still choosing what to look at; by the time a
 * customer has read a specific tile's specs their question is about THIS tile, and it needs a number
 * to ring rather than a quiz. Counting what was already on the page settles it: the sample row, the
 * buy bar's icon and the FAQ's ask-us link are three WhatsApp CTAs, the band would have been a
 * fourth, and a page with five ways to start the same conversation converts worse than one with a
 * clear two.
 *
 * ponytail: no state and no directive of its own -- it is rendered from ProductPage (which owns the
 * selected variant) so it lands in that client bundle, and there is nothing here that needs more
 * than props. The product context is baked into the wa.me text so the conversation opens with what
 * the customer is looking at, and the size they picked, instead of "Hi".
 */
export default function ProductHelp({ product, variant }) {
  // No number, no block -- a "call us" card with nothing to call is worse than no card.
  if (!WHATSAPP_NUMBER) return null;

  const orderLink = buildWhatsappLink(WHATSAPP_NUMBER, [
    `Hi Material, I'd like to order ${product.title}`,
    variant?.title && variant.title !== "Default Title" && `Size: ${variant.title}`,
    variant?.sku && `Code: ${variant.sku}`,
    `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/products/${product.handle}`,
  ]);

  return (
    // A flat mt-6 that does NOT grow on desktop, where the page's section rhythm goes to lg:mt-8:
    // this closes the details group rather than starting a new section, so it should sit nearer the
    // panels above it than the "Explore our range" shelf that follows. Since the rhythm came down
    // (user, 2026-08-13) the two match on mobile and only part company at lg -- if the rhythm is
    // ever cut again, this wants to stay one step under it rather than follow.
    <section aria-labelledby="product-help" className="container-main mt-6">
      <div className="flex flex-col gap-6 rounded-sm border border-line bg-surface px-5 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-8 lg:py-7">
        <div>
          <h2
            id="product-help"
            className="font-display text-lg tracking-[-0.02em] text-ink lg:text-xl"
          >
            Have a question? We’re here to help
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-subtle">
            Quantities, freight, or whether this suits your space — send us the room measurements and
            we will check the order before you place it.
          </p>
        </div>

        {/* Two actions, deliberately unequal: WhatsApp is filled because it is how most of these
            conversations actually start, and the number sits beside it as plain text for the
            customer who would rather ring. Both are the SAME contact, so neither is a new promise. */}
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={orderLink}
            target="_blank"
            rel="noopener noreferrer"
            // WhatsApp's own green, not Material orange: this button leaves for someone else's app,
            // and dressing it as ours would misreport where the tap goes.
            className="flex items-center justify-center gap-2.5 rounded-sm bg-[#25D366] px-6 py-3.5 text-xs font-medium uppercase tracking-wide text-white transition-opacity hover:opacity-90"
          >
            <WhatsappIcon className="size-[18px]" />
            Order on WhatsApp
          </a>

          <a
            href={`tel:+${WHATSAPP_NUMBER}`}
            className="flex items-center justify-center gap-2 rounded-sm border border-line-strong px-5 py-3.5 text-sm text-ink transition-colors hover:border-ink"
          >
            <Phone size={15} strokeWidth={1.5} className="shrink-0 text-subtle" />
            <span className="num">{FOOTER_CONTACT.phone}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
