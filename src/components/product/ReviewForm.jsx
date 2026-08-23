"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { ImagePlus, Star, X } from "lucide-react";

import { useHasMounted } from "@/hooks/useHasMounted";

/** Matches the caps in api/reviews and api/reviews/upload, so the three cannot disagree. */
const MAX_PHOTOS = 4;

/**
 * The signed-in customer's token, read the same way lib/api.js's apiFetch reads it -- redux-persist
 * JSON-encodes each value a second time, so the token comes back as the string `"ey..."` with the
 * quotes included and has to be parsed twice. Duplicated rather than exported from api.js because
 * that helper always rewrites the URL to point at the Fastify backend, and this request goes to our
 * own Next route.
 */
function readToken() {
  try {
    const slice = localStorage.getItem("persist:user");
    return slice ? JSON.parse(JSON.parse(slice).accessToken ?? "null") : null;
  } catch {
    return null;
  }
}

/**
 * Write a review.
 *
 * The only client component in the reviews system -- the list, the summary and the bar chart all
 * render on the server, so a shopper who never writes a review downloads none of this beyond the
 * form's own markup.
 *
 * PHOTOS ARE UPLOADED ON PICK, not on submit. The file goes to Shopify's CDN the moment it is
 * chosen and only the resulting URL is posted with the review, so a failed upload is reported while
 * the customer is still typing rather than swallowing a finished review at the last step. It also
 * keeps the review POST a small JSON body instead of a multipart one.
 *
 * ponytail: four useState and no form library, no validation library, no toast, no dropzone -- the
 * same call Newsletter makes. `required` and `type="email"` are the client-side validation;
 * api/reviews repeats every check because a POST need not come from this form.
 */
export default function ReviewForm({ productGid, handle }) {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | done | an error string
  // Uploaded photos, as {url, name}. They are on Shopify's CDN by the time they land here -- the
  // upload happens on pick, not on submit, so the customer sees whether it worked while they are
  // still typing rather than at the moment they press the button.
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  /**
   * Signed in? The photo control is the only part of this form that needs an account -- see the
   * note in api/reviews/upload. Everything else stays open to anyone.
   *
   * useHasMounted, not just the redux flag: `isAuthenticated` comes out of redux-persist, so on the
   * server it is always false and reading it during the first client render makes the markup
   * disagree and throws the tree away. Same guard as ProductCard's wishlist heart.
   */
  const hasMounted = useHasMounted();
  const signedIn = useSelector((state) => state.user.isAuthenticated) && hasMounted;

  async function pickPhotos(event) {
    const chosen = [...event.target.files].slice(0, MAX_PHOTOS - photos.length);
    // Clear the input immediately so picking the SAME file again after removing it still fires
    // onChange -- a file input holds its value and reports no change otherwise.
    event.target.value = "";
    if (chosen.length === 0) return;

    setUploading(true);
    setStatus("idle");
    try {
      const data = new FormData();
      for (const file of chosen) data.append("files", file);

      // apiFetch is for the Fastify backend; this route is our own, so the token is attached by
      // hand. Reading it the same way apiFetch does -- see the note there about the double JSON
      // encoding redux-persist applies.
      const res = await fetch("/api/reviews/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${readToken()}` },
        body: data,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(json.error || "Couldn’t upload that. Try again.");
        return;
      }
      setPhotos((current) => [
        ...current,
        ...json.urls.map((url, i) => ({ url, name: chosen[i]?.name ?? "photo" })),
      ]);
    } catch {
      setStatus("Couldn’t upload that. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // Captured BEFORE the await -- React nulls currentTarget once dispatch ends. See the same note
    // in Newsletter, where reading it afterwards reported failure on every success.
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus("loading");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          rating,
          productGid,
          handle,
          pictureUrls: photos.map((p) => p.url),
        }),
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      const { error } = await res.json().catch(() => ({}));
      setStatus(error || "Couldn’t send that. Try again in a moment.");
    } catch {
      setStatus("Couldn’t send that. Try again in a moment.");
    }
  }

  if (status === "done") {
    /**
     * Replaces the form — leaving the fields on screen invites a second go at something already
     * done.
     *
     * THE SENTENCE PROMISES NOTHING ABOUT MODERATION, deliberately. This store's judge.me is
     * currently set to AUTO-PUBLISH: a review posted through the API came back `published: true`
     * with no queue (verified 2026-08-22), so the earlier copy here -- "reviews are read before
     * they go up" -- was telling the customer something the shop was not doing. There IS still a
     * delay, because lib/reviews.js caches the fetch for an hour, so "not straight away" is true
     * either way and stays true if moderation is switched on later.
     */
    return (
      <p className="rounded-sm border border-line bg-surface p-4 text-sm text-ink">
        Thank you — that’s with us. It won’t appear on this page straight away.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-line bg-surface p-4">
      {/* THE RATING. Real radios, so the group is one tab stop, arrow-keys between the stars and
          announces itself; the input is sr-only and the star beside it is the visible control.
          `peer` carries focus from the hidden input onto the star, which is the whole reason the
          ring is still visible when the input is not. */}
      <fieldset>
        <legend className="text-xs font-medium text-ink">Your rating</legend>
        <div className="mt-2 flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5">
              <input
                type="radio"
                name="rating"
                value={n}
                required
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer sr-only"
              />
              <Star
                size={26}
                strokeWidth={1.25}
                aria-hidden="true"
                className={`rounded-sm transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action ${
                  n <= rating ? "fill-gold text-gold-line" : "text-line-strong"
                }`}
              />
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Your name" autoComplete="name" required />
        <Field name="email" label="Your email" type="email" autoComplete="email" required />
      </div>

      {/* Optional, and labelled as such. A required headline is what turns a one-line "arrived
          intact, colour is exactly the photo" into no review at all. */}
      <Field name="title" label="Headline" placeholder="Optional" />

      <div>
        <label htmlFor="review-body" className="text-xs font-medium text-ink">
          Your review
        </label>
        <textarea
          id="review-body"
          name="body"
          required
          rows={4}
          maxLength={2000}
          placeholder="How does it look laid? How was the delivery?"
          className="mt-1.5 w-full resize-y rounded-sm border border-line bg-background px-3 py-2.5 text-sm text-ink placeholder:text-meta focus:border-ink focus:outline-none"
        />
      </div>

      {/* PHOTOS, SIGNED-IN ONLY (user, 2026-08-23).
          Not because a photo is precious, but because this control writes a file into the
          merchant's own Shopify Files and serves it from the shop's CDN -- an open image endpoint
          is free hosting for whoever finds it. The text review above stays open to everyone; only
          the camera needs an account. See api/reviews/upload.

          A signed-out customer is TOLD the control exists rather than being shown nothing: the
          alternative is a form that quietly lacks a feature the reviews above it obviously use. */}
      <div>
        <p className="text-xs font-medium text-ink">Photos</p>
        {signedIn ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {photos.map((photo) => (
                <span key={photo.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- next/image runs the
                      Shopify CDN loader, and these are already CDN thumbnails. */}
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="h-16 w-16 rounded-sm border border-line object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((c) => c.filter((p) => p.url !== photo.url))}
                    aria-label={`Remove ${photo.name}`}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </span>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-line-strong text-subtle transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
                >
                  <ImagePlus size={16} strokeWidth={1.5} />
                  <span className="text-[10px]">{uploading ? "…" : "Add"}</span>
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={pickPhotos}
              className="sr-only"
            />
            <p className="mt-1.5 text-[11px] text-subtle">
              Up to {MAX_PHOTOS}. A photo of the tile laid is worth more than anything you can
              write.
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[11px] text-subtle">
            <Link
              href="/login"
              prefetch={false}
              className="text-action-ink underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to add photos. You can still post the review without them.
          </p>
        )}
      </div>

      {/* Not a promise the shop cannot keep: judge.me needs the address to match the review to an
          order, and it is never printed beside the review. Said here rather than in a policy page
          nobody opens mid-form. */}
      <p className="text-[11px] text-subtle">
        Your email is used to check the purchase and is never shown with your review.
      </p>

      {status !== "idle" && status !== "loading" && (
        <p role="alert" className="text-sm text-bad">
          {status}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading" || uploading}
        className="cursor-pointer rounded-sm bg-action px-6 py-3 text-xs font-semibold uppercase tracking-wide text-on-action transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Post review"}
      </button>
    </form>
  );
}

function Field({ name, label, ...props }) {
  return (
    <div>
      <label htmlFor={`review-${name}`} className="text-xs font-medium text-ink">
        {label}
      </label>
      <input
        id={`review-${name}`}
        name={name}
        {...props}
        className="mt-1.5 w-full rounded-sm border border-line bg-background px-3 py-2.5 text-sm text-ink placeholder:text-meta focus:border-ink focus:outline-none"
      />
    </div>
  );
}
