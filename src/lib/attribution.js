/**
 * Where the customer came from, kept from the first click to the order.
 *
 * WHY IT IS NOT ENOUGH TO TAG THE SIGNUP. Today the only attribution this store has is
 * `signupPath` / `signupSource`, written once at register. That answers "which page had the dialog
 * open", not "which ad was paid for" — and it answers nothing at all for a customer who signed up in
 * March and bought in August. A UTM lives in the landing URL for exactly one page view; if it is not
 * captured there it is gone, and every order after it reads as direct traffic.
 *
 * WHERE IT IS KEPT. Cookie first, localStorage as the mirror. Two stores because they fail
 * differently: the cookie survives a localStorage clear and rides along to any same-site request,
 * localStorage survives a cookie purge. Reading prefers the cookie and falls back.
 *
 * LAST NON-EMPTY TOUCH for the campaign fields: a customer who arrives on a brand search and comes
 * back through a paid ad was converted by the ad. The landing page and referrer are FIRST touch and
 * never overwritten — they are how the visitor entered this store, and that happened once.
 *
 * ponytail: no session windows, no channel grouping, no first/last split beyond the above. That is
 * a reporting decision, and it can be made in the admin from these five fields whenever somebody
 * actually asks the question.
 */
const KEY = "material_attribution";
const MAX_AGE_DAYS = 30;

// The whole vocabulary. Anything not on this list is not stored -- a query string is attacker-
// controlled, and this object ends up on a Shopify order.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
// Ad-platform click ids. Cheap to keep and the only way to reconcile a Shopify order against a
// Google or Meta report.
const CLICK_IDS = ["gclid", "fbclid"];

// Shopify tags and order attributes are not a place for 2KB of query string.
const clean = (value) => String(value || "").replace(/[\r\n]/g, " ").trim().slice(0, 120);

const readCookie = (name) =>
  document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;

export const getStoredUtms = () => {
  if (typeof window === "undefined") return {};
  for (const raw of [readCookie(KEY), localStorage.getItem(KEY)]) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // A cookie somebody hand-edited is not worth an exception on every page view.
    }
  }
  return {};
};

/**
 * Call on every navigation. Writes only when something changed, so the common case -- a customer
 * clicking through the site with no campaign in the URL -- touches neither store.
 *
 * @param {URLSearchParams} searchParams
 */
export const saveUtmsFromUrl = (searchParams) => {
  if (typeof window === "undefined") return;

  const stored = getStoredUtms();
  const next = { ...stored };
  let changed = false;

  for (const key of [...UTM_KEYS, ...CLICK_IDS]) {
    const value = clean(searchParams?.get(key));
    // Only a present value writes. An internal link with no UTMs must not erase the campaign that
    // brought the visitor in -- that is the difference between attribution and last-page-wins.
    if (value && value !== stored[key]) {
      next[key] = value;
      changed = true;
    }
  }

  // First touch, recorded once. `referrer` is empty on an internal navigation, which is exactly why
  // it is only ever written on the first page of the visit.
  if (!stored.landing) {
    next.landing = clean(window.location.pathname);
    next.referrer = clean(document.referrer);
    next.firstSeen = new Date().toISOString().slice(0, 10);
    changed = true;
  }

  if (!changed) return;

  const value = encodeURIComponent(JSON.stringify(next));
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode, or a full quota. The cookie below is the one that matters.
  }
  document.cookie = `${KEY}=${value}; max-age=${MAX_AGE_DAYS * 24 * 60 * 60}; path=/; SameSite=Lax`;
};
