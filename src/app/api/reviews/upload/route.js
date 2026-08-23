/**
 * Upload a review photograph, for a SIGNED-IN customer only.
 *
 * WHY THIS EXISTS AT ALL. Judge.me's API cannot take a file -- `picture_urls` accepts publicly
 * hosted URLs and nothing else, no multipart, no base64 -- so a photo has to live at a real URL
 * before the review can reference it. Judge.me then ingests it onto their own imgix CDN
 * (review-images.judgeme.com -- note judgeme.com, NOT judge.me), which is why our copy only has
 * to survive their background fetch. Verified end-to-end 2026-08-23.
 *
 * WHY SHOPIFY FILES rather than a new bucket. The Admin token is already here and already scoped
 * for it (see the note beside SHOPIFY_ADMIN_TOKEN in .env.local), the CDN is public and permanent,
 * and it costs nothing. Adding Cloudinary or S3 would be a vendor and a bill for storing a handful
 * of tile photographs.
 *
 * WHY SIGN-IN IS REQUIRED HERE AND NOT ON THE REVIEW ITSELF (user, 2026-08-23). An open image
 * endpoint writes attacker-chosen files into the merchant's own Shopify Files, which is a far worse
 * outcome than an open text endpoint -- it is hosting, under the shop's domain. But gating the
 * whole review would cost most of the reviews this shop will ever get, and it would not protect the
 * path that matters anyway: judge.me's own email form collects photos without ever touching this
 * site. So the text review stays open to anyone and only the camera needs an account.
 *
 * The sign-in is verified by ASKING THE BACKEND, not by reading the token here. The token is a
 * Shopify customer access token issued through material-backend's OTP flow; this service holds no
 * key to validate it, and inventing a second notion of "signed in" is how two systems end up
 * disagreeing about who someone is. GET /api/customer/profile already answers exactly this
 * question and 401s when the answer is no.
 */

import { uploadToShopifyFiles, shopifyFilesEnabled } from "@/lib/shopify-files";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";

/** A phone photo of a floor, not a raw camera file. Anything larger is resized before it is sent. */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 4;
// Allow-list, not a block-list: an SVG is a script that renders as a picture, and it would be
// served from the shop's own CDN origin.
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// ponytail: per-CUSTOMER, in memory. Stronger than the per-IP limit on the text route, because
// this one knows who is asking -- a mobile-verified account, not an address a bot can rotate.
// Resets on redeploy and is per-instance; move to a shared store if the site ever runs many.
const hits = new Map(); // customerId -> [timestamps]
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const throttled = (id) => {
  const now = Date.now();
  const recent = (hits.get(id) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 10_000) hits.clear(); // memory backstop
  return recent.length > MAX_PER_WINDOW;
};

/** Who is asking, according to the backend. null when the token is absent, expired or forged. */
async function signedInCustomer(request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const res = await fetch(`${BACKEND}/api/customer/profile`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { customer } = await res.json();
    return customer?.id ?? null;
  } catch (err) {
    // The backend being down must not silently open the gate.
    console.warn("[review-upload] auth check failed", err.message);
    return null;
  }
}

export async function POST(request) {
  if (!shopifyFilesEnabled()) {
    console.warn("[review-upload] SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN missing");
    return Response.json({ error: "Photo upload is unavailable right now." }, { status: 503 });
  }

  const customerId = await signedInCustomer(request);
  if (!customerId) {
    return Response.json({ error: "Sign in to add photos." }, { status: 401 });
  }
  if (throttled(customerId)) {
    return Response.json({ error: "Too many photos today. Try again tomorrow." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const files = form?.getAll("files").filter((f) => typeof f === "object" && f.size > 0) ?? [];

  if (files.length === 0) return Response.json({ error: "No photo attached." }, { status: 400 });
  if (files.length > MAX_FILES) {
    return Response.json({ error: `Up to ${MAX_FILES} photos.` }, { status: 400 });
  }
  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return Response.json({ error: "Photos must be JPG, PNG or WebP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Each photo must be under 8 MB." }, { status: 400 });
    }
  }

  try {
    const urls = [];
    // Sequential, not Promise.all. Four uploads is not worth the concurrency, and Shopify's Admin
    // API is cost-throttled -- a burst here is what earns a 429 that this route cannot retry out of.
    for (const file of files) urls.push(await uploadToShopifyFiles(file));
    return Response.json({ urls });
  } catch (err) {
    console.error("[review-upload]", err);
    return Response.json({ error: "Couldn’t upload that. Try again." }, { status: 502 });
  }
}
