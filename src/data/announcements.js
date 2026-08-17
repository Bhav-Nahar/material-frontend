/**
 * Announcement bar content.
 *
 * The jewelry build's TopBar fetches these from its backend on mount and renders null until the
 * request resolves -- so the bar pops in and pushes the page down on every load. We have no backend
 * yet, so these live here and render server-side. Move to the CMS when there is one.
 *
 * §18 voice: specific, no exclamation marks, no manufactured urgency. Facts only.
 */
export const ANNOUNCEMENTS = [
  { text: "Delivering across Mumbai and MMR" },
  { text: "Freight quoted before you pay — no surprises at checkout" },
  { text: "₹99 samples, refunded against your order" },
];

export const ANNOUNCEMENTS_VISIBLE = true;
