"use client";

import { Provider } from "react-redux";
import { store } from "./store";

/**
 * Copied from the jewelry build, with PersistGate REMOVED. That is a deliberate improvement, not an
 * omission.
 *
 * The jewelry build wraps the whole tree in `<PersistGate loading={null}>`, which renders null
 * until redux-persist rehydrates from localStorage. Rehydration is client-only, so the server sends
 * an empty <body> -- the header, the hero, the product grid, all of it. Every page is effectively
 * client-rendered: bad LCP, and search engines see nothing without executing JS.
 *
 * Provider itself server-renders fine; only the gate blocks. Dropping it means persisted state
 * (cart count) arrives a tick after first paint, so anything reading it should tolerate a moment
 * of zero rather than assume it is final. That is a much cheaper trade than losing SSR entirely.
 */
export default function ReduxProvider({ children }) {
  return <Provider store={store}>{children}</Provider>;
}
