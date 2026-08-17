/**
 * Pincode serviceability.
 *
 * WHAT THIS DOES NOT DO: promise a date. Material Depot's pincode box answers with "Delivery by
 * 14 Aug", which it can do because it is wired to a courier's API. There is no such API here, and
 * a date invented on the client is a promise the shop then has to honour or argue about -- the same
 * reason src/data/faqs.js marks its lead-time answer PLACEHOLDER. So this answers the question the
 * store CAN answer honestly: are you inside the area we already say we deliver to?
 *
 * The area is the MMR, which is what the announcement bar, the footer tagline and the PDP's own
 * delivery line all claim. Checked on the first three digits of the pincode, because that is what
 * India Post's own allocation makes meaningful -- the first three identify the sorting district:
 *
 *   400  Mumbai city and suburbs, and Thane city (400601-400615)
 *   401  Palghar district -- Vasai, Virar, Nalasopara, Boisar
 *   410  Raigad district -- Navi Mumbai, Panvel, Uran, Karjat, Khopoli
 *   421  Thane district -- Kalyan, Dombivli, Ulhasnagar, Ambernath, Badlapur, Bhiwandi
 *
 * ponytail: four prefixes, not a pincode table. A real serviceability list is thousands of rows and
 * belongs in the backend next to the freight calculator that will need it; swap this body for that
 * lookup when freight stops being quoted by hand. The prefixes are deliberately COARSE -- a false
 * "yes" here costs a phone call, and the freight quote at checkout is the real gate.
 */
export const SERVICEABLE_PREFIXES = ["400", "401", "410", "421"];

/**
 * @returns {{status: "invalid"|"serviceable"|"outside", pincode?: string}}
 *   invalid     -- not six digits; say nothing about delivery
 *   serviceable -- inside the MMR
 *   outside     -- a real pincode we do not claim to cover
 */
export function checkPincode(raw) {
  const pincode = String(raw ?? "").trim();
  // Leading zero is not a valid Indian pincode's first digit, and rejecting it here keeps "000000"
  // from reading as serviceable-adjacent input.
  if (!/^[1-9]\d{5}$/.test(pincode)) return { status: "invalid" };

  return SERVICEABLE_PREFIXES.includes(pincode.slice(0, 3))
    ? { status: "serviceable", pincode }
    : { status: "outside", pincode };
}
