"use client";

import { useState } from "react";
import Link from "next/link";

import { pushNewsletterSubscription } from "@/lib/gtm";

/**
 * Newsletter signup. Their JoinCommunity block, kept in shape and rebuilt in ours.
 *
 * What came across: a band with a headline, one field, one button and a line of fine print.
 *
 * What did not:
 *   - Its two side photographs. There is no newsletter imagery here, and the page already reuses
 *     the same three studio shots five times; a sixth pair would be the tiredest yet.
 *   - useMediaQuery rendering the image block TWICE, once per breakpoint. Two copies of a thing in
 *     one tree is two things to keep in step.
 *   - A hand-rolled email regex and react-toastify. `type="email" required` is the same check,
 *     enforced by the browser before a request is made, and the status line below the field says
 *     more than a toast that floats away.
 *
 * ponytail: one useState for status. No form library, no validation library, no toast library.
 */
export default function Newsletter() {
  const [status, setStatus] = useState("idle");

  async function handleSubmit(event) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "done" : "error");
      if (res.ok) {
        pushNewsletterSubscription(email);
        event.currentTarget.reset();
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    // Light band, where HelpMeChoose is a dark one. Two charcoal blocks on one page and neither
    // reads as an interruption any more.
    <section aria-labelledby="newsletter" className="border-y border-line bg-surface">
      {/* Two columns from lg. Centred in a single narrow stack, the band was a fragment floating in
          1,400px of empty paper -- the promise on one side and the field on the other fills the
          width and reads as one exchange: here is what you get, here is where to put your email. */}
      <div className="container-main grid gap-x-16 gap-y-4 py-10 lg:grid-cols-2 lg:items-center lg:py-12">
        <div>
          <h2 id="newsletter" className="text-xl lg:text-2xl">
            Still deciding?
          </h2>
          {/* PROMISES NO CADENCE, on purpose. This said "about once a month" and that is a promise
              the shop is unlikely to keep: there is one live product and no catalogue to write
              about yet. A list that goes quiet for eight months and then receives a blast gets
              marked as spam, and the damage lands on the sending domain that order confirmations
              and delivery updates depend on -- so the cost of the broken promise is not a lost
              newsletter, it is transactional mail going to junk.
              Everything named here is a TRIGGER (arrival, restock, price change) rather than a
              schedule, so the promise is kept by an event happening, not by someone finding time
              to write. Put a cadence back only when something is actually sending on one. */}
          <p className="mt-3 max-w-md text-sm leading-relaxed text-subtle">
            Leave your email and we’ll tell you when something you’d want turns up — new arrivals,
            restocks, price drops. No schedule, no spam.
          </p>
        </div>

        {status === "done" ? (
          // Replaces the form rather than sitting under it: leaving an empty box on screen invites
          // a second go at something already done.
          <p className="text-sm font-medium text-ink">
            You’re on the list. We’ll be in touch when there’s something worth the email — and not
            before.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              disabled={status === "loading"}
              className="min-w-0 flex-1 rounded-sm border border-line bg-background px-4 py-3 text-sm text-ink placeholder:text-subtle focus:border-ink focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="shrink-0 cursor-pointer rounded-sm bg-action px-6 py-3 text-sm font-medium text-on-action transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {/* "Keep me posted" answers the headline. "Sign up" answers nothing and reads as
                  the start of a form with more fields behind it. */}
              {status === "loading" ? "Signing up…" : "Keep me posted"}
            </button>
          </form>
        )}

        {/* Both live in the second column, under the form, so the fine print cannot be mistaken for
            part of the promise on the left. */}
        <div className="lg:col-start-2">
          {status === "error" && (
            <p role="alert" className="mb-2 text-sm text-bad">
              That didn’t go through. Try again in a moment.
            </p>
          )}
          <p className="text-xs text-subtle">
            Unsubscribe any time.{" "}
            <Link
              href="/pages/privacy"
              prefetch={false}
              className="underline decoration-line-strong underline-offset-4 hover:decoration-current"
            >
              Privacy policy
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
