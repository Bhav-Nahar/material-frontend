"use client";

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { openAuthModal } from "@/redux/features/user/userSlice";
import { useRehydrated } from "@/hooks/useRehydrated";

const SEEN_KEY = "material_wishlist_nudge_seen";

/**
 * First save of the session, as a guest -> open sign-in. CaratLane's PLP behaviour (user,
 * 2026-08-22), replacing the corner toast this used to draw.
 *
 * WHY THE CENTRED DIALOG AND NOT A TOAST. The toast asked for a sign-in and then made you find and
 * press a second button to start one, in a 360px box in the corner that a phone keyboard covers. The
 * modal IS the form: number, code, done, in the surface every other sign-in on the site uses. The
 * ask costs the same either way, so it may as well be answerable where it is made.
 *
 * IT STILL NEVER BLOCKS THE SAVE. This fires AFTER the item is in the list -- the guest wishlist is
 * localStorage and needs no account -- so dismissing the dialog with the X keeps the product. The
 * dialog is an offer to make the list durable, not a gate in front of the heart. If it ever becomes
 * a gate, people stop tapping the heart.
 *
 * RENDERS NOTHING. All of this component's output is one dispatch; the dialog itself is
 * GlobalAuthModal in the root layout, and the "Keep your saved items" headline it shows comes from
 * `source: "wishlist"` below (see AuthForm).
 *
 * ONCE PER SESSION. A modal on every heart tap is not a nudge, it is a fault.
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
  // AutoAuthPopup's 15s signup dialog shares this one modal and already stands down when it is
  // open; this is the other half of that. Without it a heart tap replaces a half-typed signup with
  // a login form and the number they were entering is gone.
  const isAuthModalOpen = useSelector((state) => state.user.isAuthModalOpen);

  const previousCount = useRef(null);

  useEffect(() => {
    // Wait for rehydration before taking a first reading, or the restore from localStorage looks
    // like a save and fires the nudge on page load.
    if (!rehydrated) return;

    const previous = previousCount.current;
    previousCount.current = guestCount;

    if (previous === null) return; // first reading is the baseline, not a change
    if (guestCount <= previous) return; // a removal, or no change
    if (isAuthenticated || isAuthModalOpen) return;
    if (sessionStorage.getItem(SEEN_KEY) === "true") return;

    sessionStorage.setItem(SEEN_KEY, "true");
    // Login face, not the scratch card: the pitch is the list, not a discount. `source` also picks
    // the "Keep your saved items" headline over "Welcome back", and tags the customer with
    // `source:wishlist` if they go on to register -- so you can see what this dialog is worth.
    dispatch(openAuthModal({ mode: "login", source: "wishlist" }));
  }, [guestCount, isAuthenticated, isAuthModalOpen, rehydrated, dispatch]);

  return null;
}
