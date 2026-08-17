"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Heart, X } from "lucide-react";

import { openAuthModal } from "@/redux/features/user/userSlice";
import { useRehydrated } from "@/hooks/useRehydrated";

const SEEN_KEY = "material_wishlist_nudge_seen";
const VISIBLE_MS = 7000;

/**
 * "Sign in to keep your saved items" — a toast, after the save.
 *
 * IT NEVER BLOCKS THE SAVE. The guest wishlist works without an account (localStorage), so the heart
 * does exactly what it always did and this appears afterwards. Interrupting the tap with a modal
 * would make saving harder in order to encourage saving, and the customer would learn to stop
 * tapping the heart.
 *
 * NOT THE SCRATCH CARD. The 15s popup leads with the wheel because it interrupts a stranger who has
 * no reason to sign up yet. Someone who just saved a tile has already told you what they want, and
 * answering that with "win ₹750" changes the subject — the offer reads as unrelated, and the actual
 * reason to sign in (your list survives) goes unsaid. So the pitch here is the thing they just did.
 *
 * ONCE PER SESSION. A nudge on every heart tap is how people learn to dismiss without reading.
 *
 * WATCHES THE STORE rather than listening for an event, because the heart is toggled from at least
 * four places (ProductCard, ProductGallery, the PDP, the cart). One subscription cannot be forgotten
 * at a new call site the way an event dispatch can.
 */
export default function WishlistNudge() {
  const dispatch = useDispatch();
  const rehydrated = useRehydrated();
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);
  const guestCount = useSelector((state) => state.wishlist.guestItems?.length ?? 0);

  const [open, setOpen] = useState(false);
  const previousCount = useRef(null);

  useEffect(() => {
    // Wait for rehydration before taking a first reading, or the restore from localStorage looks
    // like a save and fires the nudge on page load.
    if (!rehydrated) return;

    const previous = previousCount.current;
    previousCount.current = guestCount;

    if (previous === null) return; // first reading is the baseline, not a change
    if (guestCount <= previous) return; // a removal, or no change
    if (isAuthenticated) return;
    if (sessionStorage.getItem(SEEN_KEY) === "true") return;

    sessionStorage.setItem(SEEN_KEY, "true");
    setOpen(true);
  }, [guestCount, isAuthenticated, rehydrated]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Signing in from anywhere makes this irrelevant for the rest of the session.
  useEffect(() => {
    if (isAuthenticated) setOpen(false);
  }, [isAuthenticated]);

  if (!open) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-[360px]"
    >
      <div className="flex items-start gap-3 border border-line bg-surface p-4 shadow-[0_8px_28px_rgba(28,27,25,0.14)]">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-line bg-paper text-action-ink">
          <Heart size={15} strokeWidth={1.8} className="fill-current" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">Saved to your list</p>
          {/* The reason, stated plainly. "Create an account" is a chore; "it will still be here on
              your phone" is a reason. */}
          <p className="mt-0.5 text-xs leading-snug text-subtle">
            Sign in to keep it — your list follows you to your phone and back.
          </p>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              // Login face, not the scratch card: the pitch is the list, not a discount. `source`
              // also tags the customer with `source:wishlist` if they go on to register, so you can
              // see how many signups this nudge is actually worth.
              dispatch(openAuthModal({ mode: "login", source: "wishlist" }));
            }}
            className="mt-2.5 bg-action px-4 py-2 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90"
          >
            Sign in to save
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 p-1 text-meta transition-colors hover:text-ink"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
