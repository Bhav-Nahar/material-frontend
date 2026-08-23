import { createReview, reviewsEnabled, safePictureUrls } from "@/lib/reviews";

/**
 * Submit a review.
 *
 * The ONLY reason this route exists rather than the form posting to judge.me directly: the private
 * token. Judge.me's write endpoint takes it as a query parameter, so a browser-side POST would put
 * a read/write token for the whole review corpus into the network tab of every visitor.
 *
 * Reads do not come through here -- the PDP renders its reviews on the server (see lib/reviews.js),
 * so this is the one review request the browser ever makes, and only when someone writes one.
 */

// ponytail: same in-memory per-IP limit as api/newsletter, and for the same reason -- this writes
// into the merchant's moderation queue, and a bot loop that fills it with 10,000 rows makes the
// queue useless whether or not anything gets published. Resets on redeploy, per-instance; move to
// a shared store if the site ever runs more than one.
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const throttled = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear(); // memory backstop
  return recent.length > MAX_PER_WINDOW;
};

/** Long enough for a real opinion about a floor, short enough that the field is not a payload. */
const MAX_BODY = 2000;

export async function POST(request) {
  if (!reviewsEnabled()) {
    return Response.json({ error: "Reviews are unavailable right now." }, { status: 503 });
  }

  const payload = await request.json().catch(() => ({}));
  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const rating = Number(payload.rating);
  const productGid = String(payload.productGid ?? "");
  const handle = String(payload.handle ?? "");

  // Filtered to URLs that can only have come from api/reviews/upload -- see safePictureUrls,
  // which is where the reasoning and the test live.
  const pictureUrls = safePictureUrls(payload.pictureUrls);

  // Every one of these is also enforced by the form. Repeated here because a POST does not have to
  // come from our form, and judge.me's 422 is not a message anyone should read.
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Choose a rating from 1 to 5 stars." }, { status: 400 });
  }
  if (!name) {
    return Response.json({ error: "Add your name." }, { status: 400 });
  }
  // Same shape the browser's type="email" enforces -- see the note on the same regex in
  // api/newsletter.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!body) {
    return Response.json({ error: "Tell us a little about the tile." }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return Response.json({ error: "That review is too long." }, { status: 400 });
  }
  if (!productGid.startsWith("gid://shopify/Product/")) {
    return Response.json({ error: "Unknown product." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (throttled(ip)) {
    return Response.json({ error: "Too many reviews. Try again later." }, { status: 429 });
  }

  try {
    await createReview({ name, email, rating, title, body, productGid, handle, pictureUrls });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[reviews]", err);
    return Response.json({ error: "Couldn’t send that. Try again in a moment." }, { status: 502 });
  }
}
