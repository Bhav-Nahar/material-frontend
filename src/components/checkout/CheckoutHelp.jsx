import { Phone } from "lucide-react";

import WhatsappIcon from "@/components/common/WhatsappIcon";
import { FOOTER_CONTACT, WHATSAPP_NUMBER } from "@/data/footer";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { formatPrice } from "@/utils/formatPrice";

const STEP = { cart: "", address: " -- I'm on the address step", payment: " -- I'm on the payment step" };

/**
 * "Contact us for assistance" -- Lucira's block, under the order summary on every checkout step
 * (cart, address, payment): the question that stops an order can come up at any of them.
 *
 * The WhatsApp message carries the order itself -- each line with its size, colour and quantity,
 * the total, and which step the customer is on -- so whoever answers sees what they are asking
 * about without asking for it.
 *
 * No "Chat" button, unlike theirs: their third button opens a live-chat widget and this site has
 * none; WhatsApp IS the chat here. Hidden when no number is configured, like every other WhatsApp
 * entry point.
 */
export default function CheckoutHelp({ items = [], total = 0, step = "cart" }) {
  if (!WHATSAPP_NUMBER) return null;
  const whatsapp = buildWhatsappLink(WHATSAPP_NUMBER, [
    `Hi Material, I need help with my order${STEP[step] ?? ""}:`,
    ...items.map(
      (item) =>
        `• ${item.title}${item.variantTitle && item.variantTitle !== "Default Title" ? ` (${item.variantTitle})` : ""} × ${item.quantity}`,
    ),
    `Total ₹${formatPrice(total)}`,
  ]);

  return (
    <div className="mt-4 rounded-sm border border-line px-4 py-4">
      <p className="text-center text-[11px] font-medium uppercase tracking-wide text-ink">
        Contact us for assistance
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2.5">
        <a
          href={`tel:+${WHATSAPP_NUMBER}`}
          aria-label={`Call ${FOOTER_CONTACT.phone}`}
          className="flex items-center gap-2 rounded-full bg-paper py-1 pl-1 pr-4 text-xs text-ink transition-colors hover:bg-line"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
            <Phone size={13} strokeWidth={1.75} />
          </span>
          Call
        </a>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full bg-[#e7f7ee] py-1 pl-1 pr-4 text-xs text-ink transition-colors hover:bg-[#d5f0e1]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white">
            <WhatsappIcon className="size-[14px]" />
          </span>
          WhatsApp
        </a>
      </div>
    </div>
  );
}
