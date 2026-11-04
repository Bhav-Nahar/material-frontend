/**
 * Footer content, in one place.
 *
 * The SHOP column is NOT here -- it is read from the same menu the header uses, so a new category
 * appears in both or in neither. These are the columns that have no menu behind them.
 *
 * The jewelry build writes its footer links twice, once in a mobile tree and once in a desktop
 * tree, which is most of why its Footer.jsx is 381 lines. There is one copy here.
 */

/** §18 voice: what we do, not how we feel about it. */
export const FOOTER_TAGLINE = "Tiles, laminates and wallpaper, held in stock and delivered across Mumbai.";

export const FOOTER_COLUMNS = [
  {
    title: "Help",
    links: [
      // FAQs first: it answers most of what the other four pages say, and links onward to them.
      { label: "FAQs", href: "/pages/faqs" },
      { label: "Contact us", href: "/pages/contact" },
      { label: "Delivery and freight", href: "/pages/delivery" },
      { label: "Returns and breakage", href: "/pages/returns" },
      { label: "Cancelling an order", href: "/pages/cancellation" },
      // "Order samples" was here pointing at /pages/samples, which does not exist in Shopify. A
      // footer link to a 404 is worse than one fewer link -- add it back the day the page does.
    ],
  },
  // The "About" column is gone for now: about, pricing, installation and careers all pointed at
  // Shopify pages that do not exist. An empty column is better than four links to 404s -- bring it
  // back, with its own links, when those pages are written.
];

/**
 * Anything left empty is not rendered, so an unknown value degrades to an absent block rather than
 * a wrong one.
 *
 * The phone is real (given by the merchant); the email and address are still PLACEHOLDERS.
 */
export const FOOTER_CONTACT = {
  email: "hello@texturehouse.in", // PLACEHOLDER
  phone: "+91 70210 52482",
  address: "Mumbai, Maharashtra", // PLACEHOLDER
};

/**
 * The same line in the form wa.me wants: digits only, country code included, no + and no spaces.
 *
 * Derived rather than typed twice -- two literals of one phone number is one edit away from the
 * footer dialling one place and WhatsApp opening another.
 */
export const WHATSAPP_NUMBER = FOOTER_CONTACT.phone.replace(/\D/g, "");

/**
 * PLACEHOLDER -- empty until the real handles are known, which hides the block.
 * Shape: { label, href }. Icons are looked up by label in Footer.jsx.
 */
export const FOOTER_SOCIALS = [];

export const FOOTER_LEGAL = [
  { label: "Privacy policy", href: "/pages/privacy" },
  { label: "Terms of service", href: "/pages/terms" },
  // Required to be displayed by the Consumer Protection (E-Commerce) Rules, 2020 -- a grievance
  // route the customer cannot find is not a grievance route.
  { label: "Grievance redressal", href: "/pages/grievance-redressal" },
];
