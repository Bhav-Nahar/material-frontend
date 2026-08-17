"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Check, Clock, Copy, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  attachCartApi,
  mergeWishlistApi,
  registerCustomer,
  sendOtpApi,
  verifyOtpApi,
} from "@/lib/api";
import { getStoredUtms } from "@/lib/attribution";
import { pushLogin, pushSignup } from "@/lib/gtm";
import { login } from "@/redux/features/user/userSlice";
import { getSessionId, syncCart } from "@/redux/features/cart/cartSlice";
import { fetchWishlist } from "@/redux/features/wishlist/wishlistSlice";
import ScratchCard from "./ScratchCard";

// The login panel's photograph. Reuses the homepage hero asset rather than adding one: it is already
// on Shopify's CDN, already goes through shopifyLoader (so no Vercel image-optimisation cost), and it
// is the room the customer was just looking at.
const LOGIN_IMAGE = {
  src: "https://cdn.shopify.com/s/files/1/0778/7636/3401/files/homepage-1.png?v=1786038909",
  alt: "Living room with large-format porcelain floor tiles and a fluted wood panel wall",
};

// MSG91 sends 4 digits (its default, and what the DLT template is registered for). Must match
// OTP_LENGTH in the backend's lib/msg91.js -- rendering six boxes for a four-digit code leaves two
// empty forever and the auto-submit never fires.
const OTP_LENGTH = 4;
const RESEND_SECONDS = 60; // matches the backend's per-number cooldown

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in and sign up, one flow, two faces.
 *
 * SIGNUP: name + email + mobile -> OTP -> scratch card.
 * LOGIN:  mobile -> OTP -> done.
 *
 * Collecting the details BEFORE the OTP costs some step-one completion, and buys a real name and
 * email on every account instead of half-registered phone numbers. It also means the reward lands
 * immediately after verification rather than after a second form, which is the whole point of the
 * scratch card: verify, scratch, done.
 *
 * The two modes are a presentation choice, not a fork in the logic. verify-otp reports whether the
 * number already has an account, so picking the "wrong" entrance costs a customer nothing:
 *   - signup with an existing number -> logged straight in (no prize; they are not a new customer)
 *   - login with an unknown number   -> asked for name and email, then registered and given the card
 *
 * Extracted from the jewelry build's OtpSpinAuth, which is 916 lines because the wheel, the
 * Ornaverse calls, the prize coupon map and the auth flow all live in one component.
 */
export default function AuthForm({ onSuccess, onClose, redirectPath, mode = "login" }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const authRedirectPath = useSelector((state) => state.user.authRedirectPath);
  const cartId = useSelector((state) => state.cart.cartId);
  // Which entry point opened the dialog — tagged onto the customer so the Shopify admin can answer
  // "where do signups actually come from?" without any analytics tooling.
  const authSource = useSelector((state) => state.user.authSource);

  // Local, so the customer can correct the entrance they came through without closing the dialog.
  const [authMode, setAuthMode] = useState(mode);
  const signup = authMode === "signup";
  // Opened by "Proceed to checkout", not by a marketing surface. Same flow, different promise: this
  // one is a security step on the way to an order, so it drops the discount card and the photograph
  // and says why the number is required.
  const checkout = authSource === "cart-checkout";

  // details -> otp -> (details, if a login turned out to be new) -> scratch
  const [step, setStep] = useState(signup ? "details" : "phone");
  const [form, setForm] = useState({ firstName: "", email: "", mobile: "", acceptsMarketing: true });
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [otpProof, setOtpProof] = useState(null);
  const [prize, setPrize] = useState(null);
  // Held back rather than logged in on arrival: `login` closes the modal, which would take the card
  // off screen before it has been scratched.
  const [pendingSession, setPendingSession] = useState(null);
  const [scratched, setScratched] = useState(false);
  const [copied, setCopied] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const otpRefs = useRef([]);

  // Following a header link changes the intent behind an already-open dialog.
  useEffect(() => {
    setAuthMode(mode);
    setStep(mode === "signup" ? "details" : "phone");
    setError(null);
  }, [mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Everything that has to happen once a session exists, in one place. The guest cart and wishlist
  // are keyed by a random sessionId; without these two calls, signing in looks like losing them.
  const finishLogin = useCallback(
    /**
     * @param {boolean} isNew whether `register` just created this account. Both paths end here --
     *   a signup and a login-that-turned-out-to-be-new are the same screen -- so the ONE thing
     *   that tells `signup` from `login` is which caller we came from, and it has to be passed.
     *   Defaulting to false keeps a mis-wired caller reporting a login rather than inventing an
     *   acquisition.
     */
    async (data, isNew = false) => {
      dispatch(login({ user: data.user, accessToken: data.accessToken }));
      // Before the merges: those await the network, and an event that fires only if the wishlist
      // API answers is an event that under-reports every time it does not.
      (isNew ? pushSignup : pushLogin)(data.user);

      // allSettled, not all: a wishlist that failed to merge must not stop the cart attaching, and
      // neither should keep the customer out of a session they already paid an SMS for.
      await Promise.allSettled([
        mergeWishlistApi(getSessionId()),
        attachCartApi({ cartId }, data.accessToken),
      ]);
      dispatch(fetchWishlist());
      dispatch(syncCart());

      const target = redirectPath || authRedirectPath;
      if (target) router.push(target);
      onSuccess?.(data);
    },
    [dispatch, cartId, redirectPath, authRedirectPath, router, onSuccess],
  );

  const sendOtp = async () => {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, ""))) {
      return setError("Enter a valid 10-digit mobile number");
    }
    if (signup) {
      if (!form.firstName.trim()) return setError("Please enter your name");
      if (!EMAIL_RE.test(form.email)) return setError("Enter a valid email address");
    }

    setBusy(true);
    try {
      await sendOtpApi(form.mobile);
      setStep("otp");
      setCooldown(RESEND_SECONDS);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err?.message || "Could not send the OTP. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Registers and moves to the card. Shared by both paths, because a signup and a login-that-turned-
  // out-to-be-new end in exactly the same place.
  const register = useCallback(
    async (proof, details) => {
      const [firstName, ...rest] = details.firstName.trim().split(/\s+/);
      const data = await registerCustomer({
        otpProof: proof,
        firstName,
        lastName: rest.join(" "),
        email: details.email,
        acceptsMarketing: details.acceptsMarketing,
        // Captured at submit, not at mount: someone can browse three PDPs with the dialog open, and
        // the page they were on when they committed is the one that converted them.
        signupPath: typeof window !== "undefined" ? window.location.pathname : "",
        signupSource: authSource || "direct",
        // The campaign that brought them in, which may have been weeks and several visits ago --
        // read from the stored attribution rather than from this URL, which usually has none.
        utms: getStoredUtms(),
      });

      // The card is skipped at checkout -- a game show between the cart and the payment page is both
      // unprofessional and a place to abandon. The prize is still issued by the backend and sits on
      // the account, so nothing is lost; they meet it in their account, not mid-order.
      if (data.prize && !checkout) {
        setPrize(data.prize);
        setPendingSession(data);
        setStep("scratch");
      } else {
        await finishLogin(data, true);
      }
    },
    [finishLogin, authSource, checkout, signup],
  );

  const handleVerify = async (code) => {
    setError(null);
    setBusy(true);
    try {
      const data = await verifyOtpApi(form.mobile, code);

      if (data.status !== "REGISTER_REQUIRED") {
        // Known number. Straight in, no card — the reward is for first orders.
        await finishLogin(data);
        return;
      }

      setOtpProof(data.otpProof);
      if (form.firstName.trim() && EMAIL_RE.test(form.email)) {
        await register(data.otpProof, form);
      } else {
        // Came through Log in with a number we have never seen. We hold a valid OTP proof, so ask
        // only for the two things still missing rather than starting them over.
        setStep("details");
      }
    } catch (err) {
      setError(err?.message || "That OTP didn't work. Try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  // The details step does double duty: before the OTP for a signup, after it for a new number that
  // arrived through Log in. Holding a proof is what tells them apart.
  const submitDetails = async () => {
    if (!otpProof) return sendOtp();

    setError(null);
    if (!form.firstName.trim()) return setError("Please enter your name");
    if (!EMAIL_RE.test(form.email)) return setError("Enter a valid email address");

    setBusy(true);
    try {
      await register(otpProof, form);
    } catch (err) {
      setError(err?.message || "Could not create your account");
    } finally {
      setBusy(false);
    }
  };

  const otpValue = otp.join("");

  const setOtpAt = (index, value) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const next = [...otp];
      next[index] = "";
      return setOtp(next);
    }
    // A pasted code fills from here rather than dropping five of its six digits.
    const next = [...otp];
    digits.split("").forEach((d, i) => {
      if (index + i < OTP_LENGTH) next[index + i] = d;
    });
    setOtp(next);

    const landed = Math.min(index + digits.length, OTP_LENGTH - 1);
    otpRefs.current[landed]?.focus();
    if (next.every(Boolean)) handleVerify(next.join(""));
  };

  const onOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  // ── The reveal takes the whole dialog. Nothing competes with it. ────────────────────────────────
  if (step === "scratch") {
    return (
      <div className="flex flex-col items-center gap-5 p-7 text-center md:p-9">
        <header className="flex flex-col gap-1">
          <h2 className="font-display text-xl text-ink">
            {scratched ? "Yours to keep" : "Scratch to reveal your discount"}
          </h2>
          <p className="text-sm text-subtle">
            {scratched ? "Applied at checkout on your first order." : "Your account is ready."}
          </p>
        </header>

        <ScratchCard prize={prize} onRevealed={() => setScratched(true)} />

        {scratched && prize && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(prize.code);
              setCopied(true);
            }}
            className="num flex items-center gap-2 border border-dashed border-line-2 bg-paper px-3 py-2 text-sm text-ink"
          >
            {prize.code}
            {copied ? (
              <Check className="size-3.5 text-good" />
            ) : (
              <Copy className="size-3.5 text-subtle" />
            )}
          </button>
        )}

        <Button
          onClick={() => finishLogin(pendingSession, true)}
          disabled={!pendingSession || !scratched}
          className="w-full max-w-[280px]"
        >
          Start shopping
        </Button>
      </div>
    );
  }

  return (
    // Two panels on desktop, stacked on a phone.
    // One column at checkout: nothing to sell to someone who has already chosen. Two panels
    // everywhere else, stacked on a phone.
    <div className={checkout ? "" : "grid md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"}>
      {checkout ? null : signup ? (
        // On a PHONE this is a strip, not a panel. Stacked full-size it ran 320px tall and pushed
        // the mobile number field and the button below the fold -- before the keyboard opened, which
        // takes another 300px. The card still has to be visible (it is the offer), so it shrinks to a
        // thumbnail beside the promise instead of disappearing. Desktop keeps the full card.
        <aside className="flex items-center gap-3 border-line bg-paper p-4 max-md:border-b md:flex-col md:justify-center md:gap-4 md:p-7 md:text-center">
          <ScratchCard className="max-md:mx-0 max-md:w-[74px] max-md:shrink-0" />
          <div className="flex flex-col gap-0.5 md:gap-1.5">
            {/* The objection to a scratch card is not "is the prize good", it is "I will get the
                worst one" -- so the answer is the FLOOR, and ₹250 is a fact about the prize table
                rather than a claim. */}
            <p className="font-display text-ink max-md:text-sm md:text-lg">Every card wins</p>
            <p className="text-subtle max-md:text-xs md:text-sm">
              Guaranteed <span className="text-ink">₹250 or more</span> off your first order.
            </p>
          </div>
        </aside>
      ) : (
        // LOGIN: a photograph, not the card. A returning customer has already been sold to, and
        // dangling a first-order discount at someone who cannot claim it is worse than showing
        // nothing. Hidden on a phone: a bottom sheet has no room above the keyboard for decoration.
        <aside className="relative hidden min-h-[340px] overflow-hidden border-r border-line md:block">
          <Image src={LOGIN_IMAGE.src} alt={LOGIN_IMAGE.alt} fill sizes="300px" className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/80 to-transparent p-5 pt-12">
            <p className="font-display text-base leading-snug text-paper">
              Your orders, addresses and saved rooms — all in one place.
            </p>
          </div>
        </aside>
      )}

      <div className="flex flex-col justify-center gap-5 p-6 md:p-7">
        {(step === "details" || step === "phone") && (
          <>
            {checkout ? (
              // Two headers, because the checkout path has two asks. Before the OTP it is explaining
              // why a phone number stands between them and paying; after it, the number is verified
              // and the remaining fields are the invoice's, which is a different sentence.
              <header className="flex flex-col gap-1">
                <h2 className="font-display text-xl text-ink">
                  {otpProof ? "Billing details" : "Verify your mobile number"}
                </h2>
                <p className="flex items-center gap-2 text-sm text-subtle">
                  <Lock className="size-4 shrink-0 text-meta" />
                  {otpProof
                    ? "Your invoice and order updates go here."
                    : "Required to place an order. We'll send a one-time code."}
                </p>
              </header>
            ) : signup ? (
              <header>
                {/* The number first, and a true one: ₹750 is the ceiling of the prize table, enforced
                    by a test in the backend so the two cannot drift apart. */}
                <h2 className="font-display leading-tight text-ink max-md:text-xl md:text-2xl">
                  Win up to ₹750 off your first order
                </h2>
              </header>
            ) : (
              <header className="flex flex-col gap-1">
                {/* The headline answers whatever brought them here. "Welcome back" is wrong for
                    someone who just saved their first tile and has never had an account — and the
                    reason they were given ("keep your list") has to survive into the dialog, or the
                    nudge and the form look like two unrelated asks. */}
                <h2 className="font-display text-xl text-ink">
                  {authSource === "wishlist" ? "Keep your saved items" : "Welcome back"}
                </h2>
                <p className="flex items-center gap-2 text-sm text-subtle">
                  <Clock className="size-4 shrink-0 text-meta" />
                  {authSource === "wishlist"
                    ? "One SMS code and your list is saved to every device."
                    : "One SMS code, no password."}
                </p>
              </header>
            )}

            {/* Name and email only where they are needed: on a signup, or on a login that turned out
                to be a number we have never seen. A returning customer types one field. */}
            {(signup || otpProof) && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="auth-name">Full name</Label>
                  <Input
                    id="auth-name"
                    autoFocus
                    autoComplete="name"
                    placeholder="Rohan Sharma"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <p className="text-xs text-meta max-md:hidden">For your order confirmation and invoice.</p>
                </div>
              </>
            )}

            {!otpProof && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="auth-mobile">Mobile number</Label>
                <div className="flex items-stretch">
                  <span className="num flex items-center border border-r-0 border-line-2 bg-paper px-3 text-sm text-subtle">
                    +91
                  </span>
                  <Input
                    id="auth-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus={!signup}
                    maxLength={10}
                    className="num rounded-l-none"
                    placeholder="98765 43210"
                    value={form.mobile}
                    onChange={(e) =>
                      setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    onKeyDown={(e) => e.key === "Enter" && submitDetails()}
                  />
                </div>
              </div>
            )}

            {/* Shown at checkout too, pre-ticked, so the opt-in that gets sent is one the customer
                actually saw. Order and delivery SMS are transactional and go out regardless of this
                flag; this box is what makes the promotional half of it a real consent record. */}
            {(signup || (checkout && otpProof)) && (
              <label className="flex items-start gap-2.5 text-sm text-subtle">
                <Checkbox
                  checked={form.acceptsMarketing}
                  onCheckedChange={(v) => setForm({ ...form, acceptsMarketing: Boolean(v) })}
                  className="mt-0.5"
                />
                {/* ONE checkbox for all three channels, worded to say so. Subscribing someone to SMS
                    and WhatsApp off a checkbox labelled "offers" is the kind of consent record that
                    does not survive a TRAI or Meta complaint -- and WhatsApp Business requires an
                    explicit opt-in by policy. Pre-ticked, so the default is still subscribed. */}
                <span>
                  {checkout
                    ? "Send me order updates, offers and new arrivals by SMS, WhatsApp and email"
                    : "Send me offers and new arrivals by email, SMS and WhatsApp"}
                </span>
              </label>
            )}

            {error && <p className="text-sm text-bad">{error}</p>}

            <Button onClick={submitDetails} disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : otpProof && !checkout ? (
                "Create account"
              ) : (
                "Continue"
              )}
            </Button>

            {/* Consent sits with the action it covers: this button is where a phone number is handed
                over, so an implied-consent line is only honest if it is on screen at that click. */}
            <p className="text-center text-xs text-meta">
              By continuing you agree to Material&apos;s{" "}
              <Link href="/pages/terms" className="text-action-ink underline underline-offset-2">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link href="/pages/privacy" className="text-action-ink underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>

            {/* No "create an account instead" from checkout: an unknown number is asked for a name
                and email straight after the OTP anyway, so the switch only offers a longer road to
                the same place -- with a discount wheel parked in the middle of a payment flow. */}
            {!otpProof && !checkout && (
              <p className="border-t border-line pt-4 text-center text-sm text-subtle">
                {signup ? "Already have an account? " : "New to Material? "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(signup ? "login" : "signup");
                    setStep(signup ? "phone" : "details");
                    setError(null);
                  }}
                  className="font-medium text-action-ink underline underline-offset-2"
                >
                  {signup ? "Log in" : "Create an account"}
                </button>
              </p>
            )}
          </>
        )}

        {step === "otp" && (
          <>
            <header className="flex flex-col gap-1.5">
              <h2 className="font-display text-xl text-ink">Enter the code</h2>
              <p className="text-sm text-subtle">
                Sent to <span className="num text-ink">+91 {form.mobile}</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep(signup ? "details" : "phone");
                    setOtp(Array(OTP_LENGTH).fill(""));
                    setError(null);
                  }}
                  className="text-action-ink underline underline-offset-2"
                >
                  Change
                </button>
              </p>
            </header>

            <div className="flex gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(e) => setOtpAt(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  aria-label={`Digit ${i + 1}`}
                  className="num h-12 w-full border border-line-2 bg-surface text-center text-lg text-ink"
                />
              ))}
            </div>

            {error && <p className="text-sm text-bad">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              <Button
                onClick={() => handleVerify(otpValue)}
                disabled={busy || otpValue.length < OTP_LENGTH}
              >
                {/* Names what happens next, not the mechanism. "Verify" is a chore; the card is the
                    reason they typed six digits. */}
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : signup ? (
                  "Verify & scratch"
                ) : (
                  "Verify"
                )}
              </Button>
              <button
                type="button"
                onClick={sendOtp}
                disabled={cooldown > 0 || busy}
                className="text-sm text-subtle disabled:opacity-60"
              >
                {cooldown > 0 ? (
                  <>
                    Resend in <span className="num">{cooldown}s</span>
                  </>
                ) : (
                  "Resend code"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
