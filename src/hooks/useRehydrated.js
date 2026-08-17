"use client";

import { useSelector } from "react-redux";

import { useHasMounted } from "./useHasMounted";

/**
 * Is it safe to act on persisted auth state yet?
 *
 * We deliberately do NOT wrap the tree in <PersistGate> -- see src/redux/provider.js for why (it
 * costs SSR on every page). The trade is that `state.user.isAuthenticated` is false on the first
 * render even for a signed-in customer. So anything that ACTS on being logged out -- redirecting to
 * /login, opening the auth modal, choosing between an <a> and a <button> -- must wait for this.
 *
 * TWO CONDITIONS, and both are load-bearing:
 *
 *   hasMounted   guarantees false on the FIRST CLIENT RENDER, which is what makes this safe to
 *                branch markup on. redux-persist restores from localStorage in a microtask, which
 *                lands BEFORE hydration commits -- so the persist flag alone is already true by the
 *                time React hydrates, the client renders the signed-in markup, the server sent
 *                signed-out markup, and React throws a hydration mismatch. Not a race we can win by
 *                ordering; the mount flag is the only thing that reliably matches the server.
 *
 *   _persist     the actual "localStorage has been read" signal, off the USER slice rather than the
 *                root. `user` has a nested persist config in src/redux/store.js (so isAuthModalOpen
 *                is not persisted), which means the root `_persist` tracks a different set of keys
 *                and can report rehydrated while the user slice is still empty.
 *
 * This has now caused the same bug twice -- once in the headers, once in the account layout -- so
 * both conditions live here rather than being remembered at each call site.
 */
export const useRehydrated = () => {
  const hasMounted = useHasMounted();
  const persisted = useSelector((state) => Boolean(state.user?._persist?.rehydrated));
  return hasMounted && persisted;
};
