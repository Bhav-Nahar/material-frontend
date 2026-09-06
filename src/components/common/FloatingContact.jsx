"use client";

import { Phone } from "lucide-react";
import { usePathname } from "next/navigation";

import { FOOTER_CONTACT, WHATSAPP_NUMBER } from "@/data/footer";
import BackToTop from "./BackToTop";
import WhatsappIcon from "./WhatsappIcon";

/**
 * WhatsApp and call, parked bottom-right on every shop page.
 *
 * Two links and nothing else -- no expanding FAB, no live-chat widget, no unread badge. The
 * jewelry build's version carries all of that because it wraps Zoho SalesIQ; there is no chat
 * provider here, so the toggle would only be a lid over two buttons that already fit on screen.
 *
 * The WHATSAPP bubble is dropped on a product page, and only that one. The PDP's sticky bar already
 * carries a WhatsApp icon whose message names the product being viewed, and that bar is on screen
 * the whole time -- so the bubble is a duplicate and the worse of the two, and on a phone they stack
 * on top of the Add to Cart (user, 2026-08-22). CALL has no equivalent anywhere on the PDP, so it
 * stays. Reading the pathname is the only reason this is a client component; the hrefs are constants.
 *
 * The mobile offset clears the fixed bottom bars the PDP and PLP put on small screens (both are
 * roughly 4rem tall); from lg those bars are gone or move to the top, so it drops back down.
 *
 * ponytail: one static WhatsApp message. Per-page context ("about this product: X") means a client
 * component reading the pathname -- add it when someone actually wants to know which page an
 * enquiry came from.
 */
export default function FloatingContact() {
  const pathname = usePathname();
  const onProduct = pathname?.startsWith("/products/") ?? false;

  return (
    <div
      /* Hook for the PDP's lighting preview, which hides these on phones while its bar is open --
         the bar sits in the flow and these would otherwise land on top of its slider. */
      data-floating-contact
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 flex flex-col gap-3 lg:right-6 lg:bottom-6"
    >
      {/* TOP OF THE STACK, and only while the page is being scrolled up -- see BackToTop. It sits
          above the contact buttons because it is the transient one: the two below it are always
          there, and a control that comes and goes must not push the ones that do not. */}
      <BackToTop />

      {/* CALL stays on every page -- the PDP has no other phone entry point. Only WhatsApp drops. */}
      {!onProduct && (
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            "Hi, I want to know more about Material.",
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <WhatsappIcon className="h-6 w-6" />
        </a>
      )}
      <a
        href={`tel:${FOOTER_CONTACT.phone.replace(/\s/g, "")}`}
        aria-label={`Call us on ${FOOTER_CONTACT.phone}`}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Phone className="h-5 w-5" strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}
