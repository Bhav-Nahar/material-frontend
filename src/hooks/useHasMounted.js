import { useEffect, useState } from "react";

/**
 * False on the server and on the first client render, true afterwards.
 *
 * Anything read from redux-persist (cart quantity, wishlist) lives in localStorage, which does not
 * exist during SSR. Rendering it directly makes the server HTML disagree with the first client
 * render, and React responds by throwing away the whole tree and rebuilding it -- which detaches
 * every Swiper instance on the page and leaves the hero and product rails blank.
 *
 * Gate persisted values behind this so both renders agree, then let the real value appear.
 */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
