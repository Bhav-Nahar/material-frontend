"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";

import { openAuthModal } from "@/redux/features/user/userSlice";
import { useRehydrated } from "@/hooks/useRehydrated";

const SHOW_AFTER_MS = 15000;
const SEEN_KEY = "material_auth_popup_seen";

// Places the popup must not interrupt. /login and /checkout already ask for the same thing, and
// interrupting someone reading the terms with a discount wheel is the worst possible moment.
const EXCLUDED = [/^\/login$/, /^\/checkout(\/|$)/, /^\/pages\/(terms|privacy)/];

/**
 * Opens sign-up 15 seconds in for a visitor who isn't signed in.
 *
 * ALWAYS "signup" MODE. This is the one surface where the wheel is the right pitch: nobody asked for
 * this dialog, so it has about a second to justify interrupting, and a prize wheel does that faster
 * than any sentence. The header's "Log in" gets the photograph instead -- see AuthForm.
 *
 * DRIVES THE EXISTING DIALOG rather than rendering its own. The jewelry build's AutoAuthPopup
 * mounts a SECOND AuthDialog next to the global one, so two dialogs sit in the tree and either can
 * open over the other. Dispatching openAuthModal reuses the one GlobalAuthModal already renders.
 *
 * WAITS FOR REHYDRATION. `isAuthenticated` is false on the first render even for a signed-in
 * customer (see src/redux/provider.js -- no PersistGate, deliberately), and 15s is not reliably
 * long enough to assume otherwise on a slow device. Without this gate the popup eventually greets
 * returning customers with a signup offer. The jewelry build's version has this bug and is only
 * saved by PersistGate blocking its whole tree.
 *
 * ONCE PER SESSION, and never again once dismissed -- sessionStorage, so it does not follow someone
 * across days. An offer that reappears on every page load is not a conversion tool, it is a reason
 * to leave.
 */
export default function AutoAuthPopup() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const rehydrated = useRehydrated();
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);
  const isAuthModalOpen = useSelector((state) => state.user.isAuthModalOpen);

  // Signing in at any point retires the popup for the rest of the session.
  useEffect(() => {
    if (isAuthenticated) sessionStorage.setItem(SEEN_KEY, "true");
  }, [isAuthenticated]);

  useEffect(() => {
    if (!rehydrated || isAuthenticated || isAuthModalOpen) return;
    if (sessionStorage.getItem(SEEN_KEY) === "true") return;
    if (EXCLUDED.some((pattern) => pattern.test(pathname || ""))) return;

    const timer = setTimeout(() => {
      // Re-checked on fire: fifteen seconds is long enough for the customer to have signed in from
      // the header, or opened the dialog themselves, since the timer was set.
      dispatch((_, getState) => {
        const { user } = getState();
        if (user.isAuthenticated || user.isAuthModalOpen) return;
        sessionStorage.setItem(SEEN_KEY, "true");
        dispatch(openAuthModal({ redirectPath: null, mode: "signup", source: "auto-popup-15s" }));
      });
    }, SHOW_AFTER_MS);

    return () => clearTimeout(timer);
  }, [pathname, rehydrated, isAuthenticated, isAuthModalOpen, dispatch]);

  return null;
}
