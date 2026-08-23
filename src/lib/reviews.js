/**
 * Product reviews, from Judge.me.
 *
 * WHY AN APP AT ALL, and why this one. Reviews have to be COLLECTED as well as shown -- the
 * post-delivery email that asks for one is the whole system, and writing that means a scheduler, a
 * mail sender, a one-time token per order and a moderation queue. Judge.me's free plan does all of
 * that for nothing, and its free-plan limits are limits on ITS WIDGETS (branding, the Q&A block,
 * the hosted reviews page) -- which is exactly the part we do not use. We take the JSON and render
 * the page's own components, so the free tier costs us nothing visible.
 *
 * WHAT DOES NOT COME BACK from this file: no judge.me script tag, no judge.me stylesheet, no
 * `<div class="jdgm-widget">` waiting to be hydrated by a third party. The browser never talks to
 * judge.me at all -- reads happen here, on the server, cached with the page; writes go through
 * /api/reviews so the token stays server-side. That is also why only the PRIVATE token is in
 * .env.local: the public token exists for browsers calling judge.me directly, and no browser does.
 *
 * REVIEWS ARE NOT LOAD-BEARING. getProduct throws when Shopify is down, because a PDP without a
 * price is not a page. This returns null instead: judge.me being down must cost the reviews
 * section, not the ability to buy a floor.
 */

// Judge.me keys the store on its myshopify domain -- the same one the Storefront and Admin calls
// use, so it is not a second copy of the same fact.
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.JUDGEME_PRIVATE_TOKEN;
const API = "https://judge.me/api/v1";

/** Configured at all? Everything below no-ops rather than throwing when the tokens are absent. */
export const reviewsEnabled = () => Boolean(DOMAIN && TOKEN);

async function judgeme(path, params, revalidate) {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("shop_domain", DOMAIN);
  url.searchParams.set("api_token", TOKEN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return res.json();
}

/**
 * Everything the PDP renders about reviews, in two requests.
 *
 * Judge.me holds its OWN product ids and the reviews endpoint only accepts those, so a Shopify
 * product id has to be resolved first. That mapping is created once when judge.me syncs the
 * catalogue and never changes, hence the 24h cache against the reviews' 1h -- the lookup is
 * effectively free after the first render.
 *
 * ponytail: per_page=100 and no pagination. One page is every review this store will have for a
 * long time, and fetching them all is what lets the average, the count and the bar chart be
 * computed from the same array instead of from three more endpoints. Add paging to the LIST (a
 * "show more" that calls /api/reviews) when a product passes ~100; the summary can keep coming
 * from judge.me's own aggregate at that point.
 */
export async function getReviews(productGid) {
  if (!reviewsEnabled()) return null;

  // "gid://shopify/Product/123" -> "123". Judge.me stores the platform's numeric id.
  const externalId = String(productGid ?? "").split("/").pop();
  if (!externalId) return null;

  try {
    const { product } = await judgeme("products/-1", { external_id: externalId }, 86400);
    if (!product?.id) return null;

    const { reviews } = await judgeme(
      "reviews",
      { product_id: product.id, per_page: 100 },
      3600,
    );
    return summarize(reviews);
  } catch (err) {
    // A 404 here is the normal state of a product judge.me has not synced yet, so this is a warn
    // and not an error -- but it is logged, because "no reviews section" and "reviews section
    // broken" look identical on the page.
    console.warn("[reviews]", err.message);
    return null;
  }
}

/**
 * Every product's rating, in ONE request, for the stars on a product card.
 *
 * THE WHOLE POINT is that this does not scale with the number of cards. `GET /reviews` with no
 * product_id returns the shop's entire review corpus, each row carrying its own
 * `product_external_id` -- so a 24-card collection page costs one fetch, not 24, and no
 * products/-1 id resolution at all. The obvious implementation (look up each card's product, then
 * its reviews) is 48 requests for a grid and would rate-limit the shop.
 *
 * Keyed by the SHOPIFY numeric id as a string, which is what `product_external_id` holds, so a
 * caller only has to split its own gid.
 *
 * ponytail: per_page=100, so card stars come from the 100 most recent reviews shop-wide. Past that
 * a product whose only reviews are old would silently lose its stars on the grid while keeping them
 * on its own PDP (which fetches per-product). Page this, or switch to judge.me's aggregate
 * endpoint, when the shop crosses ~100 reviews total.
 */
export async function getRatings() {
  if (!reviewsEnabled()) return {};
  try {
    const { reviews } = await judgeme("reviews", { per_page: 100 }, 3600);
    return groupRatings(reviews);
  } catch (err) {
    console.warn("[ratings]", err.message);
    return {};
  }
}

/**
 * Ratings onto card products, non-destructively. Every product gets a `rating` key -- `{count,
 * average}` or null -- so a card never has to ask whether the field exists.
 *
 * Awaiting this costs nothing after the first call in a revalidate window: getRatings is one cached
 * fetch shared by every shelf, rail and search result on the page.
 */
export async function attachRatings(products) {
  if (!products?.length) return products ?? [];
  const ratings = await getRatings();
  return products.map((p) => ({
    ...p,
    rating: ratings[String(p.id ?? "").split("/").pop()] ?? null,
  }));
}

/** Matches the caps in api/reviews/upload and ReviewForm. */
const MAX_PHOTOS = 4;

/**
 * The photo URLs a review is allowed to carry.
 *
 * PICTURE URLS ARE NOT TAKEN ON TRUST. The browser posts back whatever api/reviews/upload gave it,
 * and that route only ever returns Shopify CDN links -- so anything else did not come from an
 * upload, and accepting it would let a stranger staple any image on the internet to a review on
 * this shop's product page. Judge.me then copies it onto their own CDN and it is permanent: their
 * API can neither edit nor delete a review.
 *
 * Parsed with `new URL` and matched on the exact hostname, never a substring. `includes(
 * "cdn.shopify.com")` passes https://evil.example/cdn.shopify.com/x.jpg, and endsWith passes
 * https://notcdn.shopify.com -- both are the classic ways this check is written wrong.
 *
 * Pure and exported for the test: this is the boundary between a stranger's JSON and a permanent
 * record on the shop's own product page, and it is worth proving rather than eyeballing.
 */
export function safePictureUrls(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_PHOTOS).filter((raw) => {
    try {
      const url = new URL(String(raw));
      return url.protocol === "https:" && url.hostname === "cdn.shopify.com";
    } catch {
      return false;
    }
  });
}

/**
 * Post a review. Judge.me decides whether it publishes, and cannot mark it verified -- which is
 * correct rather than a limitation: a review typed by someone who never bought anything is not a
 * verified purchase, and it comes back `verified: "not-yet"` so no badge is drawn.
 *
 * WARNING, and the thing to check in the judge.me admin: this store currently AUTO-PUBLISHES.
 * A review posted through this function came back `published: true` with no moderation queue
 * (verified 2026-08-22), which means anything this endpoint accepts is live on the PDP within the
 * hour. The rate limit in api/reviews is the only thing between a bot and the product page. Turn
 * on manual approval in judge.me (Settings → Reviews) if that is not wanted.
 *
 * Returns true on success. Nothing is revalidated -- the page picks the review up when its own
 * cache window turns over.
 */
export async function createReview({
  name,
  email,
  rating,
  title,
  body,
  productGid,
  handle,
  pictureUrls = [],
}) {
  if (!reviewsEnabled()) return false;

  const url = new URL(`${API}/reviews`);
  url.searchParams.set("shop_domain", DOMAIN);
  url.searchParams.set("api_token", TOKEN);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: "shopify",
      // `id` is judge.me's name for the EXTERNAL product id here, unlike the reviews GET above
      // which wants their internal one. Their API, their inconsistency.
      id: String(productGid ?? "").split("/").pop(),
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/products/${handle}`,
      name,
      email,
      rating,
      title,
      body,
      // URLs, never bytes -- judge.me has no upload endpoint and ignores base64. They fetch each
      // one in the background and re-host it on their own imgix CDN -- review-images.judgeme.com, note
      // judgeme.com and NOT judge.me, confirmed end-to-end 2026-08-23 with four derived sizes -- so the
      // Shopify copy only has to stay reachable for a few minutes. It is left in place anyway:
      // Shopify Files is free, and deleting it early would lose the photograph permanently, with
      // no way to re-attach it (the API can neither edit nor delete a review).
      // ponytail: no cleanup sweep. Add a weekly job that deletes review uploads older than a week
      // whose photo is confirmed live on review-images.judgeme.com, if the Files list gets noisy.
      ...(pictureUrls.length > 0 && { picture_urls: pictureUrls }),
    }),
  });

  if (!res.ok) throw new Error(`reviews POST responded ${res.status}`);
  return true;
}

/* ---------------------------------------------------------------------- mapping */

/**
 * The array judge.me returns, reduced to what the page prints.
 *
 * Pure and exported so reviews.test.mjs can hold it to the two things that would be wrong without
 * looking wrong: an average that includes reviews nobody is allowed to see, and a rounding that
 * lets 4.449 print as 4.5 next to a "4.4 average" claim in the schema.
 */
/**
 * The shop's whole review corpus, collapsed to one {count, average} per product id.
 *
 * Pure and exported for the test, because the two ways this goes wrong are both silent: counting a
 * review the merchant hid (stars on a card the PDP does not show) and counting STORE reviews, which
 * carry `product_external_id: 0` and belong to no product -- left in, they would put a rating on
 * whichever product happened to share that key.
 */
export function groupRatings(reviews) {
  const totals = {}; // external id -> [sum, count]

  for (const r of reviews ?? []) {
    if (!r?.published || r.hidden) continue;
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) continue;
    // A store review (external id 0 or absent) is about the shop, not a product.
    const id = String(r.product_external_id ?? "");
    if (!id || id === "0") continue;

    const [sum, count] = totals[id] ?? [0, 0];
    totals[id] = [sum + r.rating, count + 1];
  }

  return Object.fromEntries(
    Object.entries(totals).map(([id, [sum, count]]) => [
      id,
      // Same one-decimal rounding as summarize, so a card and its PDP cannot print 4.3 and 4.35.
      { count, average: Math.round((sum / count) * 10) / 10 },
    ]),
  );
}

export function summarize(reviews) {
  const list = (reviews ?? [])
    // Hidden and unpublished reviews still come back on the private token -- that is the point of
    // a private token. Neither may reach the page, and neither may reach the AVERAGE: a 1-star the
    // merchant has hidden must not drag the number the page prints.
    .filter((r) => r?.published && !r.hidden)
    .filter((r) => Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title?.trim() || "",
      body: r.body?.trim() || "",
      name: r.reviewer?.name?.trim() || "Verified customer",
      createdAt: r.created_at ?? null,
      // ONLY "buyer". Judge.me carries several verification states and this is the one that means
      // an order was matched -- printing a "Verified purchase" badge against any other value would
      // be putting the shop's word behind something judge.me did not say.
      verified: r.verified === "buyer",
      // Sizes vary by upload; compact is the thumbnail. Plain URLs, rendered by a plain <img> --
      // next/image runs a custom Shopify loader here (next.config.mjs) that would append Shopify's
      // resize params to a judge.me URL and get a 404.
      photos: (r.pictures ?? [])
        .map((p) => p?.urls?.compact || p?.urls?.original || null)
        .filter(Boolean),
    }));

  const count = list.length;
  const total = list.reduce((sum, r) => sum + r.rating, 0);

  // Distribution keyed 1-5 with zeroes present, so the bar chart can map over a fixed scale rather
  // than only over the ratings that happen to exist.
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of list) distribution[r.rating] += 1;

  return {
    count,
    // One decimal, the granularity the stars are drawn at and the figure published in the product
    // schema. Both read the same field so Google and the page can never disagree.
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    distribution,
    // Newest first. Judge.me's default order is not documented, and "the most recent thing said
    // about this tile" is the one a shopper is actually looking for.
    reviews: list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  };
}
